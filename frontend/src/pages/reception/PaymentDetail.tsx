import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ReasonModal } from '../../components/ReasonModal'
import { Alert, Badge, Button, ButtonLink, Card, Loading, PageHeader, statusTone } from '../../components/ui'
import { api, errorMessage, openDocument } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { date, dateTime, fcfa } from '../../lib/format'
import type { Payment } from '../../lib/types'

export default function PaymentDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [cancelOpen, setCancelOpen] = useState(false)
  const payment = useQuery({ queryKey: ['payments', 'detail', id], queryFn: () => api<{ data: Payment }>(`payments/${id}`).then((r) => r.data) })

  if (payment.isLoading) return <Loading />
  if (!payment.data) return <Alert>{errorMessage(payment.error)}</Alert>
  const p = payment.data

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader
        title={`Reçu ${p.numero_recu}`}
        subtitle={dateTime(p.created_at)}
        actions={
          <>
            <Button onClick={() => openDocument(`payments/${p.id}/receipt`)}>Imprimer (A5)</Button>
            <Button variant="secondary" onClick={() => openDocument(`payments/${p.id}/receipt?format=80mm`)}>Ticket 80 mm</Button>
          </>
        }
      />

      {p.annulation && (
        <Alert title="Paiement annulé">
          Le {dateTime(p.annulation.created_at)} par {p.annulation.par} — motif : {p.annulation.motif}
        </Alert>
      )}

      <Card>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Item label="Membre">{p.member ? <Link to={`/membres/${p.member.id}`} className="font-semibold hover:underline">{p.member.nom_complet}</Link> : 'Client séance'}</Item>
          <Item label="Formule">{p.plan?.nom}</Item>
          <Item label="Montant dû">{fcfa(p.montant_du)}</Item>
          <Item label="Réduction">{p.reduction > 0 ? `${fcfa(p.reduction)} — ${p.motif_reduction} (autorisée par ${p.reduction_autorisee_par ?? '—'})` : 'Aucune'}</Item>
          <Item label="Montant encaissé"><span className="text-xl font-extrabold">{fcfa(p.montant_encaisse)}</span></Item>
          <Item label="Mode">{p.mode_libelle}{p.reference_transaction && ` — réf. ${p.reference_transaction}`}</Item>
          <Item label="Encaisseur">{p.encaisseur?.nom}</Item>
          <Item label="Session de caisse">n° {p.cash_session_id}</Item>
          {p.abonnement && (
            <Item label="Abonnement">
              {date(p.abonnement.date_debut)} → {date(p.abonnement.date_fin)} <Badge tone={statusTone(p.abonnement.statut)}>{p.abonnement.statut_libelle}</Badge>
            </Item>
          )}
          {p.ticket && (
            <Item label="Ticket">
              <Link to={`/tickets/${p.ticket.id}`} className="font-semibold hover:underline">{p.ticket.numero}</Link> <Badge tone={statusTone(p.ticket.statut)}>{p.ticket.statut_libelle}</Badge>
            </Item>
          )}
        </dl>
      </Card>

      {p.ticket && <ButtonLink to={`/tickets/${p.ticket.id}`} variant="secondary">Afficher le QR du ticket</ButtonLink>}

      {user?.role === 'admin' && !p.annule && (
        <Card title="Correction">
          <p className="mb-3 text-slate-600 dark:text-slate-400">Un paiement n'est jamais modifié ni supprimé. Pour corriger une erreur, annulez-le avec un motif : l'abonnement ou le ticket associé sera annulé.</p>
          <Button variant="danger" onClick={() => setCancelOpen(true)}>Annuler ce paiement…</Button>
        </Card>
      )}

      <ReasonModal
        open={cancelOpen}
        title={`Annuler le paiement ${p.numero_recu}`}
        confirmLabel="Annuler le paiement"
        danger
        onClose={() => setCancelOpen(false)}
        onConfirm={async (motif) => {
          await api(`payments/${p.id}/cancel`, { body: { motif } })
          queryClient.invalidateQueries({ queryKey: ['payments'] })
        }}
      />
    </div>
  )
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-slate-500 dark:text-slate-400">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
