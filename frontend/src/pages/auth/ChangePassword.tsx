import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router'
import { Alert, Button, Field, Input, Loading } from '../../components/ui'
import { api, ApiError, errorMessage } from '../../lib/api'
import { homeFor, useAuth } from '../../lib/auth'
import type { User } from '../../lib/types'

type Form = { mot_de_passe_actuel: string; nouveau_mot_de_passe: string; nouveau_mot_de_passe_confirmation: string }

/** Changement de mot de passe (obligatoire à la première connexion). Règles de robustesse vérifiées par le serveur. */
export default function ChangePassword() {
  const { user, loading, setUser, logout } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<ApiError | null>(null)
  const { register, handleSubmit, formState } = useForm<Form>()

  if (loading) return <Loading />
  if (!user) return <Navigate to="/connexion" replace />

  const onSubmit = async (values: Form) => {
    setError(null)
    try {
      const r = await api<{ data: User }>('auth/password', { body: values })
      setUser(r.data)
      navigate(homeFor(r.data.role), { replace: true })
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, errorMessage(e)))
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <h1 className="text-2xl font-extrabold">Changer mon mot de passe</h1>
        {user.doit_changer_mdp && <Alert tone="amber">Pour votre sécurité, choisissez un nouveau mot de passe avant de continuer.</Alert>}
        {error && !error.errors && <Alert>{error.message}</Alert>}
        <Field label="Mot de passe actuel" error={error?.field('mot_de_passe_actuel')}>
          <Input type="password" autoComplete="current-password" {...register('mot_de_passe_actuel', { required: true })} />
        </Field>
        <Field label="Nouveau mot de passe" hint="10 caractères minimum, avec majuscules, minuscules et chiffres." error={error?.field('nouveau_mot_de_passe')}>
          <Input type="password" autoComplete="new-password" {...register('nouveau_mot_de_passe', { required: true })} />
        </Field>
        <Field label="Confirmer le nouveau mot de passe">
          <Input type="password" autoComplete="new-password" {...register('nouveau_mot_de_passe_confirmation', { required: true })} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="lg" className="flex-1" loading={formState.isSubmitting}>Enregistrer</Button>
          {!user.doit_changer_mdp ? (
            <Button type="button" variant="secondary" size="lg" onClick={() => navigate(-1)}>Annuler</Button>
          ) : (
            <Button type="button" variant="ghost" size="lg" onClick={() => logout().then(() => navigate('/connexion'))}>Se déconnecter</Button>
          )}
        </div>
      </form>
    </div>
  )
}
