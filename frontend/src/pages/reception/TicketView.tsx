import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { Alert, Badge, Button, Card, Loading, PageHeader, statusTone } from '../../components/ui'
import { api, errorMessage, openDocument } from '../../lib/api'
import { date } from '../../lib/format'
import type { Ticket } from '../../lib/types'

type TicketDetail = { data: Ticket; qr_data_uri: string; whatsapp_url: string; whatsapp_url_membre: string | null }

/** Ticket séance : QR à l'écran, impression, ou envoi du lien par WhatsApp (sans API). */
export default function TicketView() {
  const { id } = useParams()
  const ticket = useQuery({ queryKey: ['ticket', id], queryFn: () => api<TicketDetail>(`tickets/${id}`) })

  if (ticket.isLoading) return <Loading />
  if (!ticket.data) return <Alert>{errorMessage(ticket.error)}</Alert>
  const t = ticket.data.data

  return (
    <div className="max-w-md space-y-5">
      <PageHeader title={`Ticket ${t.numero}`} subtitle={`Valable le ${date(t.valable_le)} uniquement`} />
      <Card>
        <div className="flex flex-col items-center gap-3">
          <img src={ticket.data.qr_data_uri} alt={`QR du ticket ${t.numero}`} className="w-64 max-w-full rounded-xl bg-white p-2" />
          <p className="text-3xl font-black tracking-wider">{t.numero}</p>
          <Badge tone={statusTone(t.statut)}>{t.statut_libelle}</Badge>
          <p className="text-center text-sm text-slate-500">Usage unique. Le client présente ce QR (ou le numéro) au poste d'entrée.</p>
        </div>
      </Card>
      <div className="grid gap-2">
        <Button size="lg" onClick={() => openDocument(t.pdf_url)}>Imprimer le ticket</Button>
        {ticket.data.whatsapp_url_membre && (
          <a href={ticket.data.whatsapp_url_membre} target="_blank" rel="noopener" className="inline-flex min-h-14 items-center justify-center rounded-xl bg-emerald-600 px-6 text-lg font-semibold text-white hover:bg-emerald-700">
            Envoyer au membre par WhatsApp
          </a>
        )}
        <a href={ticket.data.whatsapp_url} target="_blank" rel="noopener" className="inline-flex min-h-14 items-center justify-center rounded-xl bg-white px-6 text-lg font-semibold ring-1 ring-slate-300 dark:bg-slate-800 dark:ring-slate-600">
          Envoyer par WhatsApp (choisir le contact)
        </a>
      </div>
    </div>
  )
}
