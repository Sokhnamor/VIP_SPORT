import { Save } from 'lucide-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { Alert, Avatar, Button, Card, Field, Input, Loading, PageHeader, Select, Textarea } from '../../components/ui'
import { api, ApiError } from '../../lib/api'
import type { Member } from '../../lib/types'

// Forme des champs uniquement ; le format du téléphone et les doublons sont vérifiés par le serveur.
const schema = z.object({
  nom: z.string().trim().min(1, 'Le nom est obligatoire.').max(100),
  prenom: z.string().trim().min(1, 'Le prénom est obligatoire.').max(100),
  telephone: z.string().trim().min(9, 'Le téléphone est obligatoire (ex. 77 123 45 67).'),
  email: z.union([z.literal(''), z.email('Adresse e-mail invalide.')]),
  date_naissance: z.string(),
  sexe: z.enum(['', 'M', 'F']),
  contact_urgence: z.string().max(150),
  notes: z.string().max(2000),
})
type Form = z.infer<typeof schema>

export default function MemberForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [photo, setPhoto] = useState<File | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  const existing = useQuery({
    queryKey: ['member', id],
    queryFn: () => api<{ data: Member }>(`members/${id}`).then((r) => r.data),
    enabled: editing,
  })

  const { register, handleSubmit, reset, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { nom: '', prenom: '', telephone: '', email: '', date_naissance: '', sexe: '', contact_urgence: '', notes: '' },
  })

  useEffect(() => {
    if (existing.data) {
      const m = existing.data
      reset({
        nom: m.nom, prenom: m.prenom, telephone: m.telephone_affiche, email: m.email ?? '', date_naissance: m.date_naissance ?? '',
        sexe: m.sexe ?? '', contact_urgence: m.contact_urgence ?? '', notes: m.notes ?? '',
      })
    }
  }, [existing.data, reset])

  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const onSubmit = async (values: Form) => {
    setError(null)
    const form = new FormData()
    for (const [key, value] of Object.entries(values)) {
      form.append(key, value ?? '')
    }
    if (photo) form.append('photo', photo)

    try {
      const r = await api<{ data: Member }>(editing ? `members/${id}` : 'members', { method: 'POST', form })
      await queryClient.invalidateQueries({ queryKey: ['members'] })
      await queryClient.invalidateQueries({ queryKey: ['member', String(r.data.id)] })
      navigate(`/membres/${r.data.id}`)
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'Erreur inattendue.'))
    }
  }

  if (editing && existing.isLoading) return <Loading />

  const duplicateId = error?.code === 'TELEPHONE_DOUBLON' ? (error.context?.member_id as number | undefined) : undefined

  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Membres" title={editing ? 'Modifier le membre' : 'Nouveau membre'} subtitle="Le téléphone sert d'identifiant unique ; la photo est vérifiée à chaque entrée." />
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Card>
          <div className="space-y-4">
            {error && !error.errors && (
              <Alert>
                {error.message}{' '}
                {duplicateId && <Link to={`/membres/${duplicateId}`} className="font-bold underline">Ouvrir sa fiche</Link>}
              </Alert>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <Avatar url={preview ?? existing.data?.photo_url} name={existing.data?.nom_complet ?? '?'} size="lg" />
              <Field label="Photo (fortement recommandée)" hint="Affichée à chaque scan pour vérifier l'identité. JPEG, PNG ou WebP, 5 Mo max." error={error?.field('photo')}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="user"
                  onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-slate-200 file:px-4 file:font-semibold dark:file:bg-slate-700"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prénom" required error={formState.errors.prenom?.message ?? error?.field('prenom')}>
                <Input {...register('prenom')} autoFocus={!editing} />
              </Field>
              <Field label="Nom" required error={formState.errors.nom?.message ?? error?.field('nom')}>
                <Input {...register('nom')} />
              </Field>
              <Field label="Téléphone" required hint="Numéro sénégalais, ex. 77 123 45 67" error={formState.errors.telephone?.message ?? error?.field('telephone')}>
                <Input type="tel" inputMode="tel" {...register('telephone')} />
              </Field>
              <Field label="E-mail" error={formState.errors.email?.message ?? error?.field('email')}>
                <Input type="email" {...register('email')} />
              </Field>
              <Field label="Date de naissance" error={error?.field('date_naissance')}>
                <Input type="date" {...register('date_naissance')} />
              </Field>
              <Field label="Sexe">
                <Select {...register('sexe')}>
                  <option value="">—</option>
                  <option value="F">Femme</option>
                  <option value="M">Homme</option>
                </Select>
              </Field>
              <Field label="Contact d'urgence" hint="Nom et téléphone">
                <Input {...register('contact_urgence')} />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea {...register('notes')} />
            </Field>
          </div>
        </Card>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit" size="lg" icon={Save} loading={formState.isSubmitting}>{editing ? 'Enregistrer' : 'Créer le membre'}</Button>
          <Button type="button" size="lg" variant="secondary" onClick={() => navigate(-1)}>Annuler</Button>
        </div>
      </form>
    </div>
  )
}
