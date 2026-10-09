import { Building2, Clock, Save, ScanLine } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Alert, Button, Card, Field, Input, Loading, PageHeader } from '../../components/ui'
import { api, ApiError } from '../../lib/api'
import type { Settings as SettingsType } from '../../lib/types'

export default function Settings() {
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api<{ data: SettingsType }>('settings').then((r) => r.data) })
  // Le formulaire n'est monté qu'une fois les paramètres chargés : il part de ces valeurs.
  return settings.data ? <SettingsForm initial={settings.data} /> : <Loading />
}

function SettingsForm({ initial }: { initial: SettingsType }) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<SettingsType>(initial)
  const [logo, setLogo] = useState<File | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  const set = <K extends keyof SettingsType>(key: K, value: SettingsType[K]) => { setValues({ ...values, [key]: value }); setSaved(false) }

  const save = async () => {
    setLoading(true)
    setError(null)
    try {
      const body = {
        nom_salle: values.nom_salle, adresse: values.adresse, telephone: values.telephone,
        heure_ouverture: values.heure_ouverture, heure_fermeture: values.heure_fermeture,
        une_entree_par_jour: values.une_entree_par_jour, mode_sortie: values.mode_sortie,
        seuil_alerte_expiration: values.seuil_alerte_expiration,
      }
      await api('settings', { method: 'PUT', body })
      if (logo) {
        const form = new FormData()
        form.append('logo', logo)
        await api('settings/logo', { method: 'POST', form })
        setLogo(null)
      }
      await queryClient.invalidateQueries({ queryKey: ['settings'] })
      setSaved(true)
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'Erreur inattendue.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader eyebrow="Configuration" title="Paramètres" />
      {saved && <Alert tone="green">Paramètres enregistrés.</Alert>}
      {error && <Alert>{error.errors ? Object.values(error.errors).flat().join(' ') : error.message}</Alert>}

      <Card title="La salle" icon={Building2}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom de la salle"><Input value={values.nom_salle} onChange={(e) => set('nom_salle', e.target.value)} /></Field>
          <Field label="Téléphone"><Input value={values.telephone ?? ''} onChange={(e) => set('telephone', e.target.value)} /></Field>
          <div className="sm:col-span-2"><Field label="Adresse"><Input value={values.adresse ?? ''} onChange={(e) => set('adresse', e.target.value)} /></Field></div>
          <Field label="Logo (reçus et cartes)" hint="PNG, JPEG ou WebP, 2 Mo max.">
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-slate-200 file:px-4 file:font-semibold dark:file:bg-slate-700" />
          </Field>
          {values.logo_url && <img src={values.logo_url} alt="Logo actuel" className="h-16 object-contain" />}
        </div>
      </Card>

      <Card title="Horaires" icon={Clock}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ouverture"><Input type="time" value={values.heure_ouverture} onChange={(e) => set('heure_ouverture', e.target.value)} /></Field>
          <Field label="Fermeture" hint="Les présences encore ouvertes sont clôturées automatiquement à cette heure."><Input type="time" value={values.heure_fermeture} onChange={(e) => set('heure_fermeture', e.target.value)} /></Field>
        </div>
      </Card>

      <Card title="Contrôle d'accès et alertes" icon={ScanLine}>
        <div className="space-y-3">
          <label className="flex min-h-11 items-center gap-3 font-medium">
            <input type="checkbox" className="size-5" checked={values.une_entree_par_jour} onChange={(e) => set('une_entree_par_jour', e.target.checked)} />
            Une seule entrée par jour et par membre
          </label>
          <label className="flex min-h-11 items-center gap-3 font-medium">
            <input type="checkbox" className="size-5" checked={values.mode_sortie} onChange={(e) => set('mode_sortie', e.target.checked)} />
            Activer le scan de sortie (interrupteur Entrée / Sortie au poste de scan)
          </label>
          <div className="max-w-xs">
            <Field label="Alerte d'expiration (jours)" hint="Abonnements listés comme « expirant bientôt ».">
              <Input type="number" min={1} max={60} value={values.seuil_alerte_expiration} onChange={(e) => set('seuil_alerte_expiration', Number(e.target.value))} />
            </Field>
          </div>
        </div>
      </Card>

      <Button size="lg" icon={Save} onClick={save} loading={loading}>Enregistrer les paramètres</Button>
    </div>
  )
}
