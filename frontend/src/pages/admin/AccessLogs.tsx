import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { Badge, Card, Empty, Field, Input, Loading, PageHeader, Pagination, Select, Table, Td, statusTone } from '../../components/ui'
import { api, qs } from '../../lib/api'
import { dateTime, scanLabel, todayIso } from '../../lib/format'
import type { AccessLog, Paginated } from '../../lib/types'

const RESULTS = ['ACCEPTE', 'ACCEPTE_ALERTE', 'DEJA_SCANNE', 'REFUSE_EXPIRE', 'REFUSE_SUSPENDU', 'REFUSE_ANNULE', 'REFUSE_INCONNU', 'REFUSE_QUOTA_JOUR', 'TICKET_UTILISE', 'TICKET_EXPIRE']

/** Journal de tous les scans, refus compris. */
export default function AccessLogs() {
  const [page, setPage] = useState(1)
  const [du, setDu] = useState(todayIso())
  const [au, setAu] = useState(todayIso())
  const [resultat, setResultat] = useState('')
  const [manuel, setManuel] = useState('')

  const logs = useQuery({
    queryKey: ['access-logs', page, du, au, resultat, manuel],
    queryFn: () => api<Paginated<AccessLog>>('access-logs' + qs({ page, du, au, resultat, manuel: manuel === '' ? undefined : manuel })),
  })

  return (
    <div>
      <PageHeader eyebrow="Contrôle" title="Journal des accès" subtitle="Chaque scan, accepté ou refusé, et les entrées manuelles." />
      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Du"><Input type="date" value={du} onChange={(e) => { setDu(e.target.value); setPage(1) }} /></Field>
          <Field label="Au"><Input type="date" value={au} onChange={(e) => { setAu(e.target.value); setPage(1) }} /></Field>
          <Field label="Résultat">
            <Select value={resultat} onChange={(e) => { setResultat(e.target.value); setPage(1) }}>
              <option value="">Tous</option>
              {RESULTS.map((r) => <option key={r} value={r}>{scanLabel(r)}</option>)}
            </Select>
          </Field>
          <Field label="Type">
            <Select value={manuel} onChange={(e) => { setManuel(e.target.value); setPage(1) }}>
              <option value="">Scans et manuels</option>
              <option value="0">Scans</option>
              <option value="1">Entrées manuelles</option>
            </Select>
          </Field>
        </div>
        {logs.isLoading && <Loading />}
        {logs.data?.data.length === 0 && <Empty>Aucun accès.</Empty>}
        {logs.data && logs.data.data.length > 0 && (
          <Table head={['Date', 'Personne', 'Résultat', 'Sens', 'Opérateur', 'IP']}>
            {logs.data.data.map((l) => (
              <tr key={l.id}>
                <Td className="whitespace-nowrap">{dateTime(l.scanned_at)}</Td>
                <Td>
                  {l.member ? <Link to={`/membres/${l.member.id}`} className="hover:underline">{l.member.nom_complet}</Link> : l.ticket ? `Ticket ${l.ticket}` : <span className="text-slate-500">QR inconnu</span>}
                </Td>
                <Td>
                  <Badge tone={statusTone(l.resultat)}>{scanLabel(l.resultat)}</Badge>
                  {l.manuel && <span className="block text-xs text-amber-700">manuel : {l.motif_manuel}</span>}
                </Td>
                <Td>{l.type === 'sortie' ? 'Sortie' : 'Entrée'}</Td>
                <Td>{l.operateur}</Td>
                <Td className="text-xs text-slate-500">{l.ip}</Td>
              </tr>
            ))}
          </Table>
        )}
        {logs.data?.meta && <Pagination page={page} lastPage={logs.data.meta.last_page} onChange={setPage} />}
      </Card>
    </div>
  )
}
