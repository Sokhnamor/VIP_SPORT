import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { useDebounced } from '../../components/MemberSearch'
import { Avatar, Badge, ButtonLink, Card, Empty, Input, Loading, PageHeader, Pagination, Table, Td, statusTone } from '../../components/ui'
import { api, qs } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { date } from '../../lib/format'
import type { Member, Paginated } from '../../lib/types'

export default function Members() {
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [archives, setArchives] = useState(false)
  const term = useDebounced(q.trim())

  const members = useQuery({
    queryKey: ['members', 'list', term, page, archives],
    queryFn: () => api<Paginated<Member>>('members' + qs({ q: term, page, archives })),
  })

  return (
    <div>
      <PageHeader title="Membres" actions={<ButtonLink to="/membres/nouveau">+ Nouveau membre</ButtonLink>} />
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input type="search" placeholder="Rechercher (nom, téléphone)…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} className="max-w-md" />
          {user?.role === 'admin' && (
            <label className="flex min-h-11 items-center gap-2 font-medium">
              <input type="checkbox" className="size-5" checked={archives} onChange={(e) => setArchives(e.target.checked)} /> Inclure les archivés
            </label>
          )}
        </div>

        {members.isLoading && <Loading />}
        {members.data && members.data.data.length === 0 && <Empty>Aucun membre.</Empty>}
        {members.data && members.data.data.length > 0 && (
          <Table head={['Membre', 'Téléphone', 'Abonnement', 'Inscrit le']}>
            {members.data.data.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <Td>
                  <Link to={`/membres/${m.id}`} className="flex items-center gap-3 font-semibold hover:underline">
                    <Avatar url={m.photo_url} name={m.nom_complet} size="sm" />
                    {m.nom_complet}
                    {m.statut === 'archive' && <Badge>Archivé</Badge>}
                  </Link>
                </Td>
                <Td className="whitespace-nowrap">{m.telephone_affiche}</Td>
                <Td>
                  {m.abonnement_en_cours ? (
                    <Badge tone={statusTone(m.abonnement_en_cours.statut)}>{m.abonnement_en_cours.statut_libelle} · jusqu'au {date(m.couvert_jusqu_au)}</Badge>
                  ) : (
                    <Badge tone="red">Aucun abonnement en cours</Badge>
                  )}
                </Td>
                <Td className="whitespace-nowrap">{date(m.date_inscription)}</Td>
              </tr>
            ))}
          </Table>
        )}
        {members.data?.meta && <Pagination page={page} lastPage={members.data.meta.last_page} onChange={setPage} />}
      </Card>
    </div>
  )
}
