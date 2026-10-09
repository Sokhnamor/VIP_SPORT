import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Html5Qrcode } from 'html5-qrcode'
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
  vert: 'bg-emerald-600',
  orange: 'bg-orange-500',
  jaune: 'bg-yellow-400 text-slate-950',
  rouge: 'bg-red-600',
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
        { fps: 10, qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.7); return { width: s, height: s } } },
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
    <div className="flex h-dvh flex-col bg-slate-950 text-white select-none">
      {/* Barre d'état */}
      <header className="flex items-center gap-3 px-4 py-3">
        <span className={cx('inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold', connected ? 'bg-emerald-700' : 'bg-red-700')} role="status">
          <span className={cx('size-2.5 rounded-full', connected ? 'bg-emerald-300' : 'animate-pulse bg-red-300')} />
          {connected ? 'Connecté' : 'Hors ligne'}
        </span>
        <span className="truncate font-bold">{stats.data?.nom_salle ?? 'Contrôle d\'accès'}</span>
        <span className="ml-auto text-right">
          <span className="block text-2xl leading-none font-black">{stats.data?.entrees_jour ?? '—'}</span>
          <span className="text-xs text-slate-400">entrées aujourd'hui</span>
        </span>
      </header>

      {!connected && (
        <div className="mx-4 rounded-xl bg-red-700 p-3 text-center font-semibold">
          Connexion perdue : les scans sont impossibles. Le serveur décide de chaque entrée — patientez ou vérifiez le Wi-Fi.
        </div>
      )}

      {stats.data?.mode_sortie && (
        <div className="mx-4 mt-2 grid grid-cols-2 gap-2 rounded-2xl bg-slate-800 p-1">
          {(['entree', 'sortie'] as const).map((t) => (
            <button key={t} onClick={() => setType(t)} className={cx('min-h-12 rounded-xl text-lg font-bold', type === t ? (t === 'entree' ? 'bg-emerald-600' : 'bg-sky-600') : 'text-slate-300')}>
              {t === 'entree' ? 'Entrée' : 'Sortie'}
            </button>
          ))}
        </div>
      )}

      {/* Caméra */}
      <div className="relative flex-1 overflow-hidden p-4">
        <div id="qr-reader" className="mx-auto h-full max-w-xl overflow-hidden rounded-2xl bg-black [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
        {cameraError && (
          <div className="absolute inset-4 flex items-center justify-center rounded-2xl bg-slate-900 p-6 text-center text-lg">{cameraError}</div>
        )}
        {busy && <div className="absolute top-6 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/80 px-4 py-1 text-sm">Vérification…</div>}
      </div>

      {/* Actions */}
      <footer className="grid grid-cols-2 gap-2 p-4 pt-0">
        <button onClick={() => setManualOpen(true)} className="min-h-14 rounded-xl bg-slate-800 text-lg font-bold">Saisir un code</button>
        <button onClick={fullscreen} className="min-h-14 rounded-xl bg-slate-800 text-lg font-bold">Plein écran</button>
        {user?.role === 'scanner' ? (
          <button onClick={() => logout().then(() => navigate('/connexion'))} className="col-span-2 min-h-11 rounded-xl text-sm text-slate-400">Déconnexion du poste</button>
        ) : (
          <Link to="/" className="col-span-2 flex min-h-11 items-center justify-center rounded-xl text-sm text-slate-400">← Retour à la réception</Link>
        )}
      </footer>

      {/* Saisie manuelle de secours */}
      {manualOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4" onClick={() => setManualOpen(false)}>
          <form onSubmit={onManual} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-2xl bg-slate-900 p-5">
            <h2 className="text-xl font-bold">Saisie manuelle</h2>
            <p className="text-slate-400">Code imprimé sous le QR (carte membre) ou numéro du ticket (T-XXXXXXXX).</p>
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="block min-h-14 w-full rounded-xl bg-slate-800 px-4 font-mono text-xl tracking-wider text-white ring-1 ring-slate-600 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              placeholder="T-XXXXXXXX ou M-…"
            />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setManualOpen(false)} className="min-h-12 rounded-xl bg-slate-700 font-bold">Annuler</button>
              <button type="submit" className="min-h-12 rounded-xl bg-emerald-600 font-bold" disabled={!connected}>Vérifier</button>
            </div>
          </form>
        </div>
      )}

      {/* Résultat plein écran */}
      {display && (
        <button type="button" onClick={() => setDisplay(null)} className={cx('fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 p-6 text-center', COLORS[display.kind === 'result' ? display.result.couleur : display.tone])}>
          {display.kind === 'result' ? <ResultView result={display.result} /> : <p className="text-4xl font-black">{display.message}</p>}
          <span className="text-sm opacity-80">Touchez pour continuer</span>
        </button>
      )}
    </div>
  )
}

function ResultView({ result }: { result: ScanResult }) {
  const title = result.type === 'sortie'
    ? 'SORTIE'
    : { vert: 'ENTRÉE OK', orange: 'ENTRÉE OK', jaune: 'DÉJÀ SCANNÉ', rouge: 'REFUSÉ' }[result.couleur]

  return (
    <>
      <p className="text-6xl font-black tracking-tight sm:text-7xl">{title}</p>
      {/* Anti-partage : photo en grand pour vérification visuelle. */}
      {result.membre && (
        result.membre.photo_url ? (
          <img src={result.membre.photo_url} alt="" className="size-56 rounded-3xl object-cover ring-8 ring-white/40 sm:size-72" />
        ) : (
          <div className="flex size-56 items-center justify-center rounded-3xl bg-black/20 text-2xl font-bold ring-8 ring-white/30">Pas de photo</div>
        )
      )}
      {result.membre && <p className="text-4xl font-extrabold">{result.membre.nom_complet}</p>}
      {result.ticket && <p className="text-3xl font-extrabold">Ticket {result.ticket.numero}</p>}
      <p className="text-2xl font-bold sm:text-3xl">{result.message}</p>
      {result.accepte && result.membre && result.date_fin && (
        <p className="text-xl">
          Abonnement jusqu'au <strong>{date(result.date_fin)}</strong>
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
