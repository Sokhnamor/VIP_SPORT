import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, ArrowRight, BarChart3, Lock, QrCode, ShieldCheck, User, Wallet, XCircle } from 'lucide-react'
import { forwardRef, useState, type InputHTMLAttributes } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router'
import { z } from 'zod'
import bgDesktop from '../../assets/login-bg.webp'
import bgMobile from '../../assets/login-bg-mobile.webp'
import { Loading, Spinner, cx } from '../../components/ui'
import { Brand } from '../../layouts/AppLayout'
import { ApiError, errorMessage } from '../../lib/api'
import { homeFor, useAuth } from '../../lib/auth'

const schema = z.object({
  identifiant: z.string().trim().min(1, 'Saisissez votre identifiant.'),
  mot_de_passe: z.string().min(1, 'Saisissez votre mot de passe.'),
})
type Form = z.infer<typeof schema>

const features = [
  { icon: Wallet, title: 'Chaque franc tracé', text: 'Reçus numérotés, caisse clôturée, écarts visibles.' },
  { icon: QrCode, title: 'Chaque entrée contrôlée', text: 'QR vérifié par le serveur, photo à l\'écran.' },
  { icon: BarChart3, title: 'Tout piloter', text: 'Recettes, affluence et alertes en temps réel.' },
]

const YEAR = new Date().getFullYear()

export default function Login() {
  const { user, loading, login, notice } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema) })

  if (loading) return <Loading />
  if (user) return <Navigate to={user.doit_changer_mdp ? '/mot-de-passe' : homeFor(user.role)} replace />

  const onSubmit = async (values: Form) => {
    setError(null)
    try {
      const u = await login(values.identifiant, values.mot_de_passe)
      navigate(u.doit_changer_mdp ? '/mot-de-passe' : homeFor(u.role), { replace: true })
    } catch (e) {
      setError(e instanceof ApiError && e.status === 429 ? 'Trop de tentatives. Patientez une minute avant de réessayer.' : errorMessage(e))
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-ink-950 text-white">
      {/* Photo plein écran (WebP embarqué, version allégée sur mobile) */}
      <picture>
        <source media="(max-width: 767px)" srcSet={bgMobile} />
        <img src={bgDesktop} alt="" aria-hidden className="absolute inset-0 size-full animate-ken object-cover object-[60%_center]" fetchPriority="high" />
      </picture>

      {/* Voiles : lisibilité du texte, teinte de la marque, grille, vignette */}
      <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/80 to-ink-950/30 max-lg:bg-none max-lg:bg-ink-950/25" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/20 to-ink-950/40 max-lg:via-ink-950/60" />
      <div className="absolute inset-0 bg-brand-600/10 mix-blend-color" />
      <div className="bg-grid absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_25%_35%,black,transparent_70%)]" />
      <div className="absolute -top-40 -left-40 size-[520px] rounded-full bg-brand-500/25 blur-[130px]" />
      <div className="absolute -right-32 -bottom-48 size-[520px] rounded-full bg-cyan-500/20 blur-[140px]" />

      <div className="relative mx-auto grid min-h-dvh max-w-[1400px] items-end gap-10 px-5 pt-10 pb-6 lg:items-center lg:py-8 sm:px-10 lg:grid-cols-[1.15fr_1fr] lg:px-14">
        {/* Message de marque */}
        <section className="hidden lg:block">
          <div className="animate-rise"><Brand name="GymManager" /></div>

          <p className="mt-16 inline-flex animate-rise items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs font-semibold text-brand-300 backdrop-blur-md [animation-delay:80ms]">
            <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-400 opacity-70" /><span className="relative size-2 rounded-full bg-brand-400" /></span>
            Almadies 2 · Dakar
          </p>
          <h1 className="mt-6 animate-rise text-6xl leading-[1.02] font-extrabold tracking-tight [animation-delay:140ms] xl:text-7xl">
            Votre salle,<br />
            <span className="text-gradient">sous contrôle.</span>
          </h1>
          <p className="mt-6 max-w-lg animate-rise text-lg text-slate-300 [animation-delay:200ms]">
            Aucune entrée sans paiement enregistré. Membres, caisse et accès réunis dans un seul outil.
          </p>

          <ul className="mt-12 grid max-w-2xl gap-3 xl:grid-cols-3">
            {features.map((f, i) => (
              <li
                key={f.title}
                className="animate-rise rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl"
                style={{ animationDelay: `${260 + i * 90}ms` }}
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-brand-gradient shadow-glow"><f.icon className="size-5" /></span>
                <span className="mt-3 block font-bold">{f.title}</span>
                <span className="mt-1 block text-sm leading-snug text-slate-400">{f.text}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Carte de connexion en verre dépoli */}
        <section className="mx-auto w-full max-w-[440px] lg:mr-0">
          <div className="mb-6 lg:hidden">
            <Brand name="GymManager" />
            <p className="mt-5 text-4xl leading-[1.05] font-extrabold tracking-tight">Votre salle,<br /><span className="text-gradient">sous contrôle.</span></p>
          </div>

          <div className="relative animate-pop rounded-[2rem] border border-white/15 bg-white/[0.07] p-7 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.7)] backdrop-blur-2xl sm:p-9">
            {/* Liseré lumineux en haut de la carte */}
            <div className="absolute inset-x-10 -top-px h-px bg-gradient-to-r from-transparent via-brand-400 to-transparent" />

            <h2 className="text-3xl font-extrabold tracking-tight">Bon retour 👋</h2>
            <p className="mt-2 text-slate-300">Connectez-vous avec votre compte personnel.</p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
              {notice && <GlassAlert tone="amber">{notice}</GlassAlert>}
              {error && <GlassAlert tone="red">{error}</GlassAlert>}

              <GlassField label="Identifiant" error={formState.errors.identifiant?.message}>
                <User className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-white/50" />
                <GlassInput autoComplete="username" autoCapitalize="none" autoFocus placeholder="ex. awa" {...register('identifiant')} />
              </GlassField>

              <GlassField label="Mot de passe" error={formState.errors.mot_de_passe?.message}>
                <Lock className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-white/50" />
                <GlassInput type="password" autoComplete="current-password" placeholder="••••••••••" {...register('mot_de_passe')} />
              </GlassField>

              <button
                type="submit"
                disabled={formState.isSubmitting}
                className="group relative flex min-h-14 w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-brand-gradient text-base font-bold text-white shadow-glow ring-1 ring-white/25 transition hover:brightness-110 disabled:opacity-60"
              >
                {/* Reflet qui balaie le bouton au survol */}
                <span className="absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent transition-all duration-700 group-hover:left-full" />
                {formState.isSubmitting ? <Spinner className="size-5" /> : null}
                Se connecter
                <ArrowRight className="size-5 transition group-hover:translate-x-1" />
              </button>
            </form>

            <p className="mt-7 flex items-start gap-2.5 border-t border-white/10 pt-6 text-sm text-slate-400">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-400" />
              Un compte par employé. Ne partagez jamais votre mot de passe : chaque action est enregistrée à votre nom.
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">© {YEAR} GymManager · Almadies 2, Dakar</p>
        </section>
      </div>
    </div>
  )
}

function GlassField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-semibold text-slate-200">{label}</span>
      <span className="relative block">{children}</span>
      {error && (
        <span role="alert" className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-red-300">
          <AlertTriangle className="size-3.5" /> {error}
        </span>
      )}
    </label>
  )
}

const GlassInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function GlassInput(props, ref) {
  return (
    <input
      ref={ref}
      {...props}
      className="block min-h-13 w-full rounded-2xl border border-white/15 bg-white/[0.08] py-3 pr-4 pl-12 text-[15px] text-white transition placeholder:text-white/35 hover:border-white/25 focus:border-brand-400 focus:bg-white/[0.12] focus:ring-4 focus:ring-brand-400/20 focus:outline-none"
    />
  )
})

function GlassAlert({ tone, children }: { tone: 'red' | 'amber'; children: React.ReactNode }) {
  const Icon = tone === 'red' ? XCircle : AlertTriangle
  return (
    <div role={tone === 'red' ? 'alert' : 'status'} className={cx('flex gap-2.5 rounded-2xl border p-3.5 text-sm font-medium', tone === 'red' ? 'border-red-400/30 bg-red-500/15 text-red-100' : 'border-amber-400/30 bg-amber-500/15 text-amber-100')}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      {children}
    </div>
  )
}
