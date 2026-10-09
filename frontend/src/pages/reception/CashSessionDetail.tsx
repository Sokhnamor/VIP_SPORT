import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Alert, Badge, Button, Card, Empty, Field, Loading, PageHeader, StatCard, Table, Td, Textarea } from '../../components/ui'
import { api, errorMessage, openDocument } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { dateTime, fcfa, fcfaSigned, time } from '../../lib/format'
import type { CashSession, Expense, Payment } from '../../lib/types'

type Detail = { data: CashSession; paiements: Payment[]; depenses: Expense[] }

export default function CashSessionDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const detail = useQuery({ queryKey: ['cash', 'detail', id], queryFn: () => api<Detail>(`cash-sessions/${id}`) })
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (detail.isLoading) return <Loading />
  if (!detail.data) return <Alert>{errorMessage(detail.error)}</Alert>
  const { data: s, paiements, depenses } = detail.data
  const t = s.totaux!

  const saveComment = async () => {
    setSaving(true)
    setError(null)
    try {
      await api(`cash-sessions/${s.id}/comment`, { body: { commentaire: comment } })
      setComment('')
      queryClient.invalidateQueries({ queryKey: ['cash'] })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Session de caisse #${s.id}`}
        subtitle={<>{s.employe?.nom} · ouverte le {dateTime(s.ouverte_at)}{s.fermee_at && <> · clôturée le {dateTime(s.fermee_at)}</>}</>}
        actions={<Button variant="secondary" onClick={() => openDocument(`cash-sessions/${s.id}/mobile-money?format=pdf`)}>Rapprochement Wave / OM (PDF)</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Espèces attendues" value={fcfa(s.especes_attendues ?? t.especes_attendues)} />
        <StatCard label="Espèces comptées" value={fcfa(s.especes_comptees)} />
        <StatCard label="Écart" value={s.ecart === null ? '—' : fcfaSigned(s.ecart)} tone={s.ecart ? 'red' : s.ecart === 0 ? 'green' : undefined} hint={s.motif_ecart ?? undefined} />
        <StatCard label="Mobile money" value={fcfa(t.wave + t.orange_money)} hint={`Wave ${fcfa(t.wave)} · OM ${fcfa(t.orange_money)}`} />
      </div>

      {s.statut === 'cloturee' && (
        <Card title="Commentaire du patron">
          {s.commentaire_admin ? (
            <p className="mb-3">« {s.commentaire_admin} » <span className="text-sm text-slate-500">— {s.commente_par}, {dateTime(s.commente_at)}</span></p>
          ) : (
            <p className="mb-3 text-slate-500">Aucun commentaire.</p>
          )}
          {user?.role === 'admin' && (
            <div className="space-y-2">
              {error && <Alert>{error}</Alert>}
              <Field label={s.commentaire_admin ? 'Remplacer le commentaire' : 'Ajouter un commentaire'} hint="Les montants d'une clôture ne peuvent jamais être modifiés.">
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} />
              </Field>
              <Button onClick={saveComment} loading={saving} disabled={!comment.trim()}>Enregistrer le commentaire</Button>
            </div>
          )}
        </Card>
      )}

      <Card title={`Paiements (${paiements.length})`}>
        {paiements.length === 0 ? <Empty>Aucun paiement.</Empty> : (
          <Table head={['Heure', 'Reçu', 'Membre', 'Formule', 'Montant', 'Mode', '']}>
            {paiements.map((p) => (
              <tr key={p.id} className={p.annule ? 'opacity-60' : ''}>
                <Td>{time(p.created_at)}</Td>
                <Td><Link to={`/recus/${p.id}`} className="font-semibold hover:underline">{p.numero_recu}</Link></Td>
                <Td>{p.member?.nom_complet ?? 'Ticket séance'}</Td>
                <Td>{p.plan?.nom}</Td>
                <Td className="whitespace-nowrap">{fcfa(p.montant_encaisse)}</Td>
                <Td>{p.mode_libelle}{p.reference_transaction && <span className="block text-xs text-slate-500">{p.reference_transaction}</span>}</Td>
                <Td>{p.annule && <Badge tone="red">Annulé</Badge>}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title={`Dépenses payées en caisse (${depenses.length})`}>
        {depenses.length === 0 ? <Empty>Aucune dépense.</Empty> : (
          <Table head={['Date', 'Catégorie', 'Description', 'Montant', 'Statut']}>
            {depenses.map((d) => (
              <tr key={d.id}>
                <Td>{dateTime(d.created_at)}</Td>
                <Td>{d.categorie_libelle}</Td>
                <Td>{d.description}</Td>
                <Td>{fcfa(d.montant)}</Td>
                <Td><Badge>{d.statut_libelle}</Badge></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}
