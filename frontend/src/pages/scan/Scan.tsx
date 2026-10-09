import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Html5Qrcode } from 'html5-qrcode'
import { AlertTriangle, ArrowLeft, CameraOff, CheckCircle2, Clock, Keyboard, LogIn, LogOut, Maximize, ScanLine, UserRound, Wifi, WifiOff, XCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { cx } from '../../components/ui'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { date } from '../../lib/format'
import type { ScanResult } from '../../lib/types'

/** Délai minimal entre deux décisions (évite les doubles lectures du même QR). */
const COOLDOWN_MS = 1500
/** Durée d'affichage du résultat plein écran. */
const DISPLAY_MS = 4000

type Stats = { entrees_jour: number; mode_sortie: boolean; nom_salle: string; heure_serveur: string }
type Display = { kind: 'result'; result: ScanResult } | { kind: 'error'; message: string; tone: 'rouge' | 'jaune' }

const COLORS: Record<string, string> = {
  vert: 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700',
  orange: 'bg-gradient-to-br from-orange-400 via-orange-500 to-amber-600',
  jaune: 'bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-400 text-slate-950',
  rouge: 'bg-gradient-to-br from-red-500 via-red-600 to-rose-800',
}

/**
 * Poste de scan (PWA, téléphone ou tablette près de la porte).
 * Le contenu du QR est envoyé tel quel au serveur, qui décide : aucune règle n'est évaluée ici.
 */
export default function Scan() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [type, setType] = useState<'entree' | 'sortie'>('entree')
  const [display, setDisplay] = useState<Display | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [busy, setBusy] = useState(false)

  const lastDecision = useRef(0)
  const lastCode = useRef<{ code: string; at: number } | null>(null)
  const busyRef = useRef(false)
  const hideTimer = useRef<number | undefined>(undefined)
  const typeRef = useRef(type)
  useEffect(() => { typeRef.current = type }, [type])

  // Indicateur de connexion : état du navigateur + interrogation régulière du serveur.
  const stats = useQuery({
    queryKey: ['scan', 'stats'],
    queryFn: () => api<{ data: Stats }>('scan/stats').then((r) => r.data),
    refetchInterval: 20_000,
    retry: false,
  })
  const serverReachable = !stats.isError || (stats.error instanceof ApiError && stats.error.status !== 0)
  const connected = online && serverReachable

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])

  const show = useCallback((d: Display) => {
    setDisplay(d)
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setDisplay(null), DISPLAY_MS)
  }, [])

  const submit = useCallback(async (code: string, manual = false) => {
    const now = Date.now()
    if (busyRef.current || now - lastDecision.current < COOLDOWN_MS) return
    // Le même QR resté devant la caméra n'est pas renvoyé pendant l'affichage du résultat.
    if (!manual && lastCode.current?.code === code && now - lastCode.current.at < DISPLAY_MS) return
    lastCode.current = { code, at: now }
    busyRef.current = true
    setBusy(true)
    try {
      const r = await api<{ data: ScanResult }>('scan', { body: { code, type: typeRef.current } })
      lastDecision.current = Date.now()
      beep(r.data.accepte ? 'ok' : r.data.couleur === 'jaune' ? 'warn' : 'ko')
      vibrate(r.data.accepte)
      show({ kind: 'result', result: r.data })
      queryClient.invalidateQueries({ queryKey: ['scan', 'stats'] })
    } catch (e) {
      lastDecision.current = Date.now()
      beep('ko')
      const message =
        e instanceof ApiError
          ? e.status === 0
            ? 'Pas de connexion au serveur. Réessayez dès le retour du réseau.'
            : e.status === 429
              ? 'Trop d\'essais de QR invalides. Patientez une minute.'
              : e.message
          : 'Erreur inattendue.'
      show({ kind: 'error', message, tone: e instanceof ApiError && e.status === 429 ? 'jaune' : 'rouge' })
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [queryClient, show])

  // Lecture continue par la caméra arrière.
  useEffect(() => {
    const scanner = new Html5Qrcode('qr-reader', { verbose: false })
    let started = false
    scanner
      .start(
        { facingMode: 'environment' },
        // Lecture sur toute l'image (le cadre affiché est purement visuel).
        { fps: 12 },
        (text) => submit(text),
        () => undefined,
      )
      .then(() => { started = true })
      .catch((err: unknown) => {
        const msg = String(err)
        setCameraError(
          msg.includes('NotAllowed') || msg.includes('Permission')
            ? 'Accès à la caméra refusé. Autorisez la caméra dans les réglages du navigateur (HTTPS obligatoire).'
            : 'Caméra indisponible. Utilisez la saisie manuelle du code.',
        )
      })
    return () => {
      if (started) scanner.stop().then(() => scanner.clear()).catch(() => undefined)
    }
  }, [submit])

  useEffect(() => () => window.clearTimeout(hideTimer.current), [])

  const onManual = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualCode.trim()) return
    lastDecision.current = 0
    submit(manualCode.trim(), true)
    setManualCode('')
    setManualOpen(false)
  }

  const fullscreen = () => {
    document.documentElement.requestFullscreen?.().catch(() => undefined)
  }

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-ink-950 text-white select-none">
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[520px] -translate-x-1/2 rounded-full bg-brand-500/15 blur-[120px]" />

      {/* Barre d'état */}
      <header className="relative flex items-center gap-3 px-4 pt-4 pb-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient shadow-glow"><ScanLine className="size-5" strokeWidth={2.4} /></span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate font-extrabold">{stats.data?.nom_salle ?? 'Contrôle d\'accès'}</span>
          <span className={cx('flex items-center gap-1.5 text-xs font-semibold', connected ? 'text-emerald-400' : 'text-red-400')} role="status">
            {connected ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
            {connected ? 'Connecté au serveur' : 'Hors ligne'}
          </span>
        </span>
        <span className="ml-auto rounded-2xl bg-white/[0.06] px-4 py-2 text-right ring-1 ring-white/10 backdrop-blur">
          <span className="tabular block text-2xl leading-none font-extrabold">{stats.data?.entrees_jour ?? '—'}</span>
          <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">entrées</span>
        </span>
      </header>

      {!connected && (
        <div className="relative mx-4 flex items-start gap-3 rounded-2xl bg-red-600/90 p-4 font-semibold shadow-pop">
          <WifiOff className="mt-0.5 size-5 shrink-0" />
          Connexion perdue : aucun scan n'est possible. Le serveur décide de chaque entrée — vérifiez le Wi-Fi.
        </div>
      )}

      {stats.data?.mode_sortie && (
        <div className="relative mx-4 mt-1 grid grid-cols-2 gap-1 rounded-2xl bg-white/[0.06] p-1.5 ring-1 ring-white/10">
          {(['entree', 'sortie'] as const).map((t) => (
            <button key={t} onClick={() => setType(t)} className={cx('flex min-h-12 items-center justify-center gap-2 rounded-xl text-lg font-bold transition', type === t ? (t === 'entree' ? 'bg-brand-gradient shadow-glow' : 'bg-gradient-to-r from-sky-500 to-indigo-500') : 'text-slate-400')}>
              {t === 'entree' ? <LogIn className="size-5" /> : <LogOut className="size-5" />}
              {t === 'entree' ? 'Entrée' : 'Sortie'}
            </button>
          ))}
        </div>
      )}

      {/* Caméra + cadre de visée */}
      <div className="relative flex-1 overflow-hidden p-4">
        <div className="relative mx-auto h-full max-w-xl overflow-hidden rounded-[2rem] bg-black shadow-pop ring-1 ring-white/10">
          <div id="qr-reader" className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
          {!cameraError && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative aspect-square w-[68%] max-w-[340px]">
                {['top-0 left-0 border-t-4 border-l-4 rounded-tl-3xl', 'top-0 right-0 border-t-4 border-r-4 rounded-tr-3xl', 'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-3xl', 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-3xl'].map((c) => (
                  <span key={c} className={cx('absolute size-12 border-brand-400 drop-shadow-[0_0_10px_rgb(47_216_160/0.8)]', c)} />
                ))}
                <span className="absolute inset-x-4 h-0.5 animate-scan-line rounded-full bg-gradient-to-r from-transparent via-brand-400 to-transparent shadow-[0_0_16px_rgb(47_216_160/0.9)]" />
              </div>
            </div>
          )}
          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-ink-900 p-8 text-center">
              <span className="flex size-16 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10"><CameraOff className="size-8 text-slate-400" /></span>
              <p className="text-lg text-slate-300">{cameraError}</p>
            </div>
          )}
          {busy && (
            <div className="absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink-900/80 px-4 py-2 text-sm font-semibold ring-1 ring-white/10 backdrop-blur">
              <span className="size-2 animate-ping rounded-full bg-brand-400" /> Vérification…
            </div>
          )}
          <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-sm font-semibold text-white/70">Présentez le QR code dans le cadre</p>
        </div>
      </div>

      {/* Actions */}
      <footer className="relative grid grid-cols-2 gap-3 p-4 pt-0">
        <button onClick={() => setManualOpen(true)} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white/[0.07] text-base font-bold ring-1 ring-white/10 transition hover:bg-white/10">
          <Keyboard className="size-5" /> Saisir un code
        </button>
        <button onClick={fullscreen} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white/[0.07] text-base font-bold ring-1 ring-white/10 transition hover:bg-white/10">
          <Maximize className="size-5" /> Plein écran
        </button>
        {user?.role === 'scanner' ? (
          <button onClick={() => logout().then(() => navigate('/connexion'))} className="col-span-2 min-h-10 rounded-xl text-sm text-slate-500 hover:text-slate-300">Déconnexion du poste</button>
        ) : (
          <Link to="/" className="col-span-2 flex min-h-10 items-center justify-center gap-1.5 rounded-xl text-sm text-slate-500 hover:text-slate-300"><ArrowLeft className="size-4" /> Retour à la réception</Link>
        )}
      </footer>

      {/* Saisie manuelle de secours */}
      {manualOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" onClick={() => setManualOpen(false)}>
          <form onSubmit={onManual} onClick={(e) => e.stopPropagation()} className="w-full max-w-md animate-pop space-y-4 rounded-3xl bg-ink-850 p-6 ring-1 ring-white/10">
            <h2 className="flex items-center gap-3 text-xl font-bold"><Keyboard className="size-5 text-brand-400" /> Saisie manuelle</h2>
            <p className="text-slate-400">Code imprimé sous le QR (carte membre) ou numéro du ticket (T-XXXXXXXX).</p>
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="block min-h-14 w-full rounded-2xl bg-ink-950 px-4 font-mono text-xl tracking-wider text-white ring-1 ring-white/10 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              placeholder="T-XXXXXXXX ou M-…"
            />
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setManualOpen(false)} className="min-h-12 rounded-2xl bg-white/[0.07] font-bold">Annuler</button>
              <button type="submit" className="min-h-12 rounded-2xl bg-brand-gradient font-bold shadow-glow disabled:opacity-50" disabled={!connected}>Vérifier</button>
            </div>
          </form>
        </div>
      )}

      {/* Résultat plein écran */}
      {display && (
        <button type="button" onClick={() => setDisplay(null)} className={cx('fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 overflow-hidden p-6 text-center', COLORS[display.kind === 'result' ? display.result.couleur : display.tone])}>
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-40" />
          <div className="relative flex animate-pop flex-col items-center gap-5">
            {display.kind === 'result' ? <ResultView result={display.result} /> : (
              <>
                <XCircle className="size-24" strokeWidth={1.8} />
                <p className="text-4xl font-black">{display.message}</p>
              </>
            )}
          </div>
          <span className="relative mt-4 rounded-full bg-black/15 px-4 py-1.5 text-sm font-semibold">Touchez pour continuer</span>
        </button>
      )}
    </div>
  )
}

function ResultView({ result }: { result: ScanResult }) {
  const title = result.type === 'sortie'
    ? 'SORTIE'
    : { vert: 'ENTRÉE OK', orange: 'ENTRÉE OK', jaune: 'DÉJÀ SCANNÉ', rouge: 'REFUSÉ' }[result.couleur]
  const Icon = result.type === 'sortie' ? LogOut : { vert: CheckCircle2, orange: AlertTriangle, jaune: Clock, rouge: XCircle }[result.couleur]

  return (
    <>
      <span className="flex items-center gap-3">
        <Icon className="size-14 sm:size-16" strokeWidth={2.2} />
        <span className="text-5xl font-black tracking-tight sm:text-7xl">{title}</span>
      </span>
      {/* Anti-partage : photo en grand pour vérification visuelle. */}
      {result.membre && (
        result.membre.photo_url ? (
          <img src={result.membre.photo_url} alt="" className="size-56 rounded-[2.5rem] object-cover shadow-2xl ring-8 ring-white/30 sm:size-72" />
        ) : (
          <div className="flex size-56 flex-col items-center justify-center gap-2 rounded-[2.5rem] bg-black/15 text-xl font-bold ring-8 ring-white/25"><UserRound className="size-16 opacity-70" /> Pas de photo</div>
        )
      )}
      {result.membre && <p className="text-4xl font-extrabold tracking-tight">{result.membre.nom_complet}</p>}
      {result.ticket && <p className="rounded-2xl bg-black/15 px-5 py-2 font-mono text-3xl font-extrabold">{result.ticket.numero}</p>}
      <p className="text-2xl font-bold opacity-95 sm:text-3xl">{result.message}</p>
      {result.accepte && result.membre && result.date_fin && (
        <p className="rounded-full bg-black/15 px-5 py-2 text-lg font-semibold">
          Jusqu'au {date(result.date_fin)}
          {result.jours_restants !== null && <> · {result.jours_restants} jour(s) restant(s)</>}
        </p>
      )}
    </>
  )
}

/** Retour sonore : bip court aigu (accepté), bip grave (refusé). */
let audioCtx: AudioContext | null = null
function beep(kind: 'ok' | 'ko' | 'warn') {
  try {
    audioCtx ??= new AudioContext()
    const ctx = audioCtx
    const play = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = kind === 'ok' ? 'sine' : 'square'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.25, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + duration)
    }
    if (kind === 'ok') play(1200, 0, 0.15)
    else if (kind === 'warn') { play(700, 0, 0.12); play(700, 0.18, 0.12) }
    else play(220, 0, 0.6)
  } catch {
    // audio indisponible : le retour visuel suffit
  }
}

function vibrate(ok: boolean) {
  navigator.vibrate?.(ok ? 80 : [200, 100, 200])
}
