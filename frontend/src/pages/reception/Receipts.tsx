import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { useDebounced } from '../../components/MemberSearch'
import { Badge, Button, Card, Empty, Field, Input, Loading, PageHeader, Pagination, Select, Table, Td } from '../../components/ui'
import { api, openDocument, qs } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { dateTime, fcfa, MODES } from '../../lib/format'
import type { Paginated, Payment } from '../../lib/types'

/** Liste des reçus (l'admin voit tous les encaissements, le réceptionniste les siens) et réimpression. */
export default function Receipts() {
  const { user } = useAuth()
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [mode, setMode] = useState('')
  const [du, setDu] = useState('')
  const [au, setAu] = useState('')
  const term = useDebounced(q.trim())

  const payments = useQuery({
    queryKey: ['payments', page, term, mode, du, au],
    queryFn: () => api<Paginated<Payment>>('payments' + qs({ page, q: term, mode, du, au })),
  })

  return (
    <div>
      <PageHeader title="Reçus" subtitle={user?.role === 'admin' ? 'Tous les encaissements' : 'Mes encaissements'} />
      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="N° de reçu ou référence"><Input type="search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} /></Field>
          <Field label="Mode">
            <Select value={mode} onChange={(e) => { setMode(e.target.value); setPage(1) }}>
              <option value="">Tous</option>
              {Object.entries(MODES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Du"><Input type="date" value={du} onChange={(e) => { setDu(e.target.value); setPage(1) }} /></Field>
          <Field label="Au"><Input type="date" value={au} onChange={(e) => { setAu(e.target.value); setPage(1) }} /></Field>
        </div>

        {payments.isLoading && <Loading />}
        {payments.data?.data.length === 0 && <Empty>Aucun reçu.</Empty>}
        {payments.data && payments.data.data.length > 0 && (
          <Table head={['Reçu', 'Date', 'Membre', 'Formule', 'Montant', 'Mode', 'Encaisseur', '']}>
            {payments.data.data.map((p) => (
              <tr key={p.id} className={p.annule ? 'opacity-60' : ''}>
                <Td><Link to={`/recus/${p.id}`} className="font-semibold hover:underline">{p.numero_recu}</Link></Td>
                <Td className="whitespace-nowrap">{dateTime(p.created_at)}</Td>
                <Td>{p.member ? <Link to={`/membres/${p.member.id}`} className="hover:underline">{p.member.nom_complet}</Link> : 'Ticket séance'}</Td>
                <Td>{p.plan?.nom}</Td>
                <Td className="whitespace-nowrap font-semibold">{fcfa(p.montant_encaisse)}</Td>
                <Td>
                  {p.mode_libelle}
                  {p.reference_transaction && <span className="block text-xs text-slate-500">{p.reference_transaction}</span>}
                </Td>
                <Td>{p.encaisseur?.nom}</Td>
                <Td className="whitespace-nowrap">
                  {p.annule ? <Badge tone="red">Annulé</Badge> : <Button variant="ghost" onClick={() => openDocument(`payments/${p.id}/receipt`)}>Imprimer</Button>}
                </Td>
              </tr>
            ))}
          </Table>
        )}
        {payments.data?.meta && <Pagination page={page} lastPage={payments.data.meta.last_page} onChange={setPage} />}
      </Card>
    </div>
  )
}
