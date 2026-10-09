import { CalendarClock, DoorOpen, MessageCircle, ScanLine, Scale, UserX, Vault } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { SessionsTable } from '../reception/Cash'
import { Alert, Badge, Button, Card, Empty, Loading, PageHeader, Table, Td } from '../../components/ui'
import { api, errorMessage, openDocument } from '../../lib/api'
import { date, dateTime, phone, scanLabel } from '../../lib/format'
import type { AccessLog, CashSession } from '../../lib/types'

type MemberRow = { member_id: number; nom: string; telephone: string; couvert_jusqu_au: string; jours_restants: number }
type AlertsData = {
  expirent_bientot: MemberRow[]
  expires_recemment: MemberRow[]
  caisses_non_cloturees: CashSession[]
  ecarts_caisse: CashSession[]
  refus_scan: { total: number; refus: number; taux: number | null; anormal: boolean }
  entrees_manuelles: AccessLog[]
}

export default function Alerts() {
  const q = useQuery({ queryKey: ['alerts'], queryFn: () => api<{ data: AlertsData }>('alerts').then((r) => r.data) })
  if (q.isLoading) return <Loading />
  if (!q.data) return <Alert>{errorMessage(q.error)}</Alert>
  const d = q.data

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Pilotage" title="Alertes" subtitle="Ce qui demande votre attention, et les membres à relancer." />

      {d.caisses_non_cloturees.length > 0 && (
        <Card title="Caisses non clôturées (oubli)" icon={Vault}>
          <SessionsTable sessions={d.caisses_non_cloturees} showEmployee />
        </Card>
      )}

      <Card title="Scan du jour" icon={ScanLine}>
        <p className={d.refus_scan.anormal ? 'font-bold text-red-600' : ''}>
          {d.refus_scan.total} scan(s), {d.refus_scan.refus} refus{d.refus_scan.taux !== null && ` (${d.refus_scan.taux} %)`}
          {d.refus_scan.anormal && ' — taux de refus anormal : vérifiez le poste de scan et les tentatives de fraude.'}
        </p>
      </Card>

      <MemberList title="Abonnements expirant bientôt" rows={d.expirent_bientot} exportKey="expirent-bientot" empty="Aucun abonnement n'expire prochainement." />
      <MemberList title="Expirés depuis moins de 30 jours (à relancer)" rows={d.expires_recemment} exportKey="expires-recemment" empty="Aucun membre à relancer." />

      <Card title="Écarts de caisse (30 jours)" icon={Scale}>
        {d.ecarts_caisse.length === 0 ? <Empty>Aucun écart.</Empty> : <SessionsTable sessions={d.ecarts_caisse} showEmployee />}
      </Card>

      <Card title="Entrées manuelles (7 jours)" icon={DoorOpen}>
        {d.entrees_manuelles.length === 0 ? <Empty>Aucune entrée manuelle.</Empty> : (
          <Table head={['Date', 'Membre', 'Résultat', 'Motif', 'Employé']}>
            {d.entrees_manuelles.map((l) => (
              <tr key={l.id}>
                <Td className="whitespace-nowrap">{dateTime(l.scanned_at)}</Td>
                <Td>{l.member && <Link to={`/membres/${l.member.id}`} className="hover:underline">{l.member.nom_complet}</Link>}</Td>
                <Td><Badge tone={l.couleur === 'vert' ? 'green' : 'red'}>{scanLabel(l.resultat)}</Badge></Td>
                <Td>{l.motif_manuel}</Td>
                <Td>{l.operateur}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}

function MemberList({ title, rows, exportKey, empty }: { title: string; rows: MemberRow[]; exportKey: string; empty: string }) {
  return (
    <Card
      title={`${title} (${rows.length})`}
      icon={exportKey === 'expirent-bientot' ? CalendarClock : UserX}
      actions={rows.length > 0 && (
        <>
          <Button variant="secondary" onClick={() => openDocument(`alerts/${exportKey}/export`)}>CSV</Button>
          <Button variant="secondary" onClick={() => openDocument(`alerts/${exportKey}/export?format=pdf`)}>PDF</Button>
        </>
      )}
    >
      {rows.length === 0 ? <Empty>{empty}</Empty> : (
        <Table head={['Membre', 'Téléphone', 'Couvert jusqu\'au', 'Jours restants', '']}>
          {rows.map((r) => (
            <tr key={r.member_id}>
              <Td><Link to={`/membres/${r.member_id}`} className="font-semibold hover:underline">{r.nom}</Link></Td>
              <Td className="whitespace-nowrap"><a href={`tel:${r.telephone}`} className="hover:underline">{phone(r.telephone)}</a></Td>
              <Td>{date(r.couvert_jusqu_au)}</Td>
              <Td>{r.jours_restants}</Td>
              <Td>
                <a
                  href={`https://wa.me/${r.telephone.replace('+', '')}?text=${encodeURIComponent(`Bonjour ${r.nom}, votre abonnement ${r.jours_restants > 0 ? 'expire' : 'a expiré'} le ${date(r.couvert_jusqu_au)}. Pensez à le renouveler à l'accueil !`)}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
                >
                  <MessageCircle className="size-4" /> Relancer
                </a>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  )
}
