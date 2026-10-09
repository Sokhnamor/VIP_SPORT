import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Alert, Badge, Button, Card, Field, Input, Loading, Modal, PageHeader, Table, Td } from '../../components/ui'
import { api, ApiError } from '../../lib/api'
import { fcfa } from '../../lib/format'
import type { Plan } from '../../lib/types'

/** Formules et tarifs. Un changement de prix ne modifie pas les paiements passés (prix figé). */
export default function Plans() {
  const queryClient = useQueryClient()
  const plans = useQuery({ queryKey: ['plans', 'all'], queryFn: () => api<{ data: Plan[] }>('plans?tous=1').then((r) => r.data) })
  const [editing, setEditing] = useState<Partial<Plan> | null>(null)

  return (
    <div>
      <PageHeader title="Formules et tarifs" actions={<Button onClick={() => setEditing({ nom: '', duree_jours: 30, prix_fcfa: 0, est_seance: false, actif: true })}>+ Nouvelle formule</Button>} />
      <Alert tone="blue">Le prix est figé dans chaque paiement au moment de la vente : modifier un tarif n'altère jamais l'historique.</Alert>
      <Card className="mt-4">
        {plans.isLoading && <Loading />}
        {plans.data && (
          <Table head={['Formule', 'Durée', 'Prix', 'Type', 'Statut', '']}>
            {plans.data.map((p) => (
              <tr key={p.id} className={p.actif ? '' : 'opacity-60'}>
                <Td className="font-semibold">{p.nom}</Td>
                <Td>{p.est_seance ? 'Jour même' : `${p.duree_jours} jours`}</Td>
                <Td className="font-semibold whitespace-nowrap">{fcfa(p.prix_fcfa)}</Td>
                <Td>{p.est_seance ? 'Ticket séance' : 'Abonnement'}</Td>
                <Td><Badge tone={p.actif ? 'green' : 'slate'}>{p.actif ? 'En vente' : 'Retirée'}</Badge></Td>
                <Td><Button variant="ghost" onClick={() => setEditing(p)}>Modifier</Button></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {editing && <PlanForm plan={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); queryClient.invalidateQueries({ queryKey: ['plans'] }) }} />}
    </div>
  )
}

function PlanForm({ plan, onClose, onSaved }: { plan: Partial<Plan>; onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState(plan)
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(false)

  const save = async () => {
    setLoading(true)
    setError(null)
    try {
      const body = { nom: values.nom, duree_jours: Number(values.duree_jours), prix_fcfa: Number(values.prix_fcfa), est_seance: values.est_seance, actif: values.actif }
      if (plan.id) await api(`plans/${plan.id}`, { method: 'PUT', body })
      else await api('plans', { body })
      onSaved()
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'Erreur inattendue.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open title={plan.id ? `Modifier « ${plan.nom} »` : 'Nouvelle formule'} onClose={onClose} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Annuler</Button>
        <Button onClick={save} loading={loading}>Enregistrer</Button>
      </>
    }>
      <div className="space-y-3">
        {error && !error.errors && <Alert>{error.message}</Alert>}
        <Field label="Nom" error={error?.field('nom')}><Input value={values.nom ?? ''} onChange={(e) => setValues({ ...values, nom: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Durée (jours)" error={error?.field('duree_jours')}><Input type="number" min={1} value={values.duree_jours ?? ''} onChange={(e) => setValues({ ...values, duree_jours: Number(e.target.value) })} /></Field>
          <Field label="Prix (FCFA)" error={error?.field('prix_fcfa')}><Input type="number" min={0} step={500} value={values.prix_fcfa ?? ''} onChange={(e) => setValues({ ...values, prix_fcfa: Number(e.target.value) })} /></Field>
        </div>
        <label className="flex min-h-11 items-center gap-3 font-medium">
          <input type="checkbox" className="size-5" checked={values.est_seance ?? false} onChange={(e) => setValues({ ...values, est_seance: e.target.checked })} />
          Séance unique (vendue comme ticket du jour)
        </label>
        <label className="flex min-h-11 items-center gap-3 font-medium">
          <input type="checkbox" className="size-5" checked={values.actif ?? true} onChange={(e) => setValues({ ...values, actif: e.target.checked })} />
          En vente
        </label>
      </div>
    </Modal>
  )
}
