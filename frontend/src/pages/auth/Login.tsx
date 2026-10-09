import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, BarChart3, Lock, QrCode, ShieldCheck, User, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router'
import { z } from 'zod'
import { Alert, Button, Field, Input, Loading } from '../../components/ui'
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
  { icon: BarChart3, title: 'Tout piloter', text: 'Recettes, fréquentation et alertes en temps réel.' },
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
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Visuel de marque */}
      <section className="relative hidden overflow-hidden bg-ink-gradient p-12 text-white lg:flex lg:flex-col">
        <div className="bg-grid absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_at_30%_20%,black,transparent_75%)]" />
        <div className="absolute -top-32 -left-32 size-[420px] rounded-full bg-brand-500/25 blur-[110px]" />
        <div className="absolute -right-24 -bottom-40 size-[460px] rounded-full bg-cyan-500/20 blur-[120px]" />

        <div className="relative"><Brand name="GymManager" /></div>

        <div className="relative my-auto max-w-lg">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-brand-300 backdrop-blur">
            <ShieldCheck className="size-3.5" /> Almadies 2 · Dakar
          </p>
          <h1 className="text-5xl leading-[1.05] font-extrabold tracking-tight">
            Votre salle,<br />
            <span className="text-gradient">sous contrôle.</span>
          </h1>
          <p className="mt-5 text-lg text-slate-300">Aucune entrée sans paiement enregistré. Membres, caisse et accès réunis dans un seul outil.</p>

          <ul className="mt-10 space-y-4">
            {features.map((f, i) => (
              <li key={f.title} className="flex animate-rise items-start gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-4 backdrop-blur" style={{ animationDelay: `${150 + i * 90}ms` }}>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient shadow-glow"><f.icon className="size-5" /></span>
                <span>
                  <span className="block font-bold">{f.title}</span>
                  <span className="text-sm text-slate-400">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-slate-500">© {YEAR} GymManager</p>
      </section>

      {/* Formulaire */}
      <section className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-[400px] animate-rise">
          <div className="mb-10 lg:hidden"><span className="inline-block rounded-2xl bg-ink-900 p-2.5 pr-4"><Brand name="GymManager" /></span></div>

          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Bon retour 👋</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">Connectez-vous avec votre compte personnel.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
            {notice && <Alert tone="amber">{notice}</Alert>}
            {error && <Alert>{error}</Alert>}
            <Field label="Identifiant" error={formState.errors.identifiant?.message}>
              <div className="relative">
                <User className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-slate-400" />
                <Input className="min-h-12 pl-11" autoComplete="username" autoCapitalize="none" autoFocus placeholder="ex. awa" {...register('identifiant')} />
              </div>
            </Field>
            <Field label="Mot de passe" error={formState.errors.mot_de_passe?.message}>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-slate-400" />
                <Input className="min-h-12 pl-11" type="password" autoComplete="current-password" placeholder="••••••••••" {...register('mot_de_passe')} />
              </div>
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting}>
              Se connecter <ArrowRight className="size-5" />
            </Button>
          </form>

          <p className="mt-8 flex items-start gap-2.5 rounded-2xl bg-slate-900/[0.03] p-4 text-sm text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-600" />
            Un compte par employé. Ne partagez jamais votre mot de passe : chaque action est enregistrée à votre nom.
          </p>
        </div>
      </section>
    </div>
  )
}
