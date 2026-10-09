import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router'
import { z } from 'zod'
import { Alert, Button, Field, Input, Loading } from '../../components/ui'
import { ApiError, errorMessage } from '../../lib/api'
import { homeFor, useAuth } from '../../lib/auth'

const schema = z.object({
  identifiant: z.string().trim().min(1, 'Saisissez votre identifiant.'),
  mot_de_passe: z.string().min(1, 'Saisissez votre mot de passe.'),
})
type Form = z.infer<typeof schema>

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
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-brand-600 text-3xl font-black text-white">G</div>
          <h1 className="text-3xl font-extrabold">GymManager</h1>
          <p className="text-slate-600 dark:text-slate-400">Connexion du personnel</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800" noValidate>
          {notice && <Alert tone="amber">{notice}</Alert>}
          {error && <Alert>{error}</Alert>}
          <Field label="Identifiant" error={formState.errors.identifiant?.message}>
            <Input autoComplete="username" autoCapitalize="none" autoFocus {...register('identifiant')} />
          </Field>
          <Field label="Mot de passe" error={formState.errors.mot_de_passe?.message}>
            <Input type="password" autoComplete="current-password" {...register('mot_de_passe')} />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting}>
            Se connecter
          </Button>
          <p className="text-center text-sm text-slate-500">Un compte par employé. Ne partagez jamais votre mot de passe.</p>
        </form>
      </div>
    </div>
  )
}
