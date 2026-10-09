import { useQuery } from '@tanstack/react-query'
import { Fragment, useState } from 'react'
import { Card, Empty, Field, Input, Loading, PageHeader, Pagination, Select, Table, Td } from '../../components/ui'
import { api, qs } from '../../lib/api'
import { dateTime } from '../../lib/format'
import type { AuditLog, Paginated, User } from '../../lib/types'

/** Journal d'audit en lecture seule : qui, quand, quoi, avant/après, IP. */
export default function Audit() {
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')
  const [userId, setUserId] = useState('')
  const [du, setDu] = useState('')
  const [au, setAu] = useState('')
  const [open, setOpen] = useState<number | null>(null)

  const actions = useQuery({ queryKey: ['audit', 'actions'], queryFn: () => api<{ data: string[] }>('audit-logs/actions').then((r) => r.data) })
  const users = useQuery({ queryKey: ['users'], queryFn: () => api<{ data: User[] }>('users').then((r) => r.data) })
  const logs = useQuery({
    queryKey: ['audit', page, action, userId, du, au],
    queryFn: () => api<Paginated<AuditLog>>('audit-logs' + qs({ page, action, user_id: userId, du, au })),
  })

  return (
    <div>
      <PageHeader eyebrow="Contrôle" title="Journal d'audit" subtitle="Lecture seule — aucune ligne ne peut être modifiée ni supprimée." />
      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Action">
            <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(1) }}>
              <option value="">Toutes</option>
              {actions.data?.map((a) => <option key={a} value={a}>{a}</option>)}
            </Select>
          </Field>
          <Field label="Utilisateur">
            <Select value={userId} onChange={(e) => { setUserId(e.target.value); setPage(1) }}>
              <option value="">Tous</option>
              {users.data?.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
            </Select>
          </Field>
          <Field label="Du"><Input type="date" value={du} onChange={(e) => { setDu(e.target.value); setPage(1) }} /></Field>
          <Field label="Au"><Input type="date" value={au} onChange={(e) => { setAu(e.target.value); setPage(1) }} /></Field>
        </div>

        {logs.isLoading && <Loading />}
        {logs.data?.data.length === 0 && <Empty>Aucune entrée.</Empty>}
        {logs.data && logs.data.data.length > 0 && (
          <Table head={['Date', 'Utilisateur', 'Action', 'Élément', 'IP', '']}>
            {logs.data.data.map((l) => (
              <Fragment key={l.id}>
                <tr>
                  <Td className="whitespace-nowrap">{dateTime(l.created_at)}</Td>
                  <Td>{l.utilisateur ?? '—'}</Td>
                  <Td className="font-mono text-sm">{l.action}</Td>
                  <Td>{l.entite ? `${l.entite} #${l.entite_id ?? ''}` : '—'}</Td>
                  <Td className="text-xs text-slate-500">{l.ip}</Td>
                  <Td>
                    {(l.avant || l.apres) && (
                      <button className="font-semibold text-brand-700 hover:underline dark:text-brand-500" onClick={() => setOpen(open === l.id ? null : l.id)}>
                        {open === l.id ? 'Masquer' : 'Détail'}
                      </button>
                    )}
                  </Td>
                </tr>
                {open === l.id && (
                  <tr>
                    <td colSpan={6} className="bg-slate-50 p-3 dark:bg-slate-800/50">
                      <div className="grid gap-3 md:grid-cols-2">
                        <Diff title="Avant" data={l.avant} />
                        <Diff title="Après" data={l.apres} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </Table>
        )}
        {logs.data?.meta && <Pagination page={page} lastPage={logs.data.meta.last_page} onChange={setPage} />}
      </Card>
    </div>
  )
}

function Diff({ title, data }: { title: string; data: Record<string, unknown> | null }) {
  return (
    <div>
      <p className="mb-1 text-sm font-bold">{title}</p>
      <pre className="overflow-x-auto rounded-lg bg-white p-2 text-xs whitespace-pre-wrap ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        {data ? JSON.stringify(data, null, 2) : '—'}
      </pre>
    </div>
  )
}
