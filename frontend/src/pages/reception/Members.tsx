import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Search, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useDebounced } from '../../components/MemberSearch'
import { Avatar, Badge, ButtonLink, Card, Empty, Input, Loading, PageHeader, Pagination, Table, Td } from '../../components/ui'
import { api, qs } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { date } from '../../lib/format'
import type { Member, Paginated } from '../../lib/types'

export default function Members() {
  const { user } = useAuth()
  const navigate = useNavigate()
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
      <PageHeader
        eyebrow="Réception"
        title="Membres"
        subtitle={members.data?.meta ? `${members.data.meta.total} membre(s)${term ? ' trouvé(s)' : ''}` : 'Fiches, abonnements et historique'}
        actions={<ButtonLink to="/membres/nouveau" icon={UserPlus}>Nouveau membre</ButtonLink>}
      />
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 p-5 sm:p-6">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-slate-400" />
            <Input type="search" placeholder="Rechercher par nom ou téléphone…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} className="pl-11" />
          </div>
          {user?.role === 'admin' && (
            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 dark:text-slate-300 dark:ring-white/10 dark:hover:bg-white/5">
              <input type="checkbox" className="size-4 accent-emerald-600" checked={archives} onChange={(e) => setArchives(e.target.checked)} /> Inclure les archivés
            </label>
          )}
        </div>

        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          {members.isLoading && <Loading />}
          {members.data && members.data.data.length === 0 && <Empty icon={Users}>Aucun membre {term ? 'ne correspond à cette recherche' : 'pour le moment'}.</Empty>}
          {members.data && members.data.data.length > 0 && (
            <Table head={['Membre', 'Téléphone', 'Abonnement', 'Inscrit le', '']}>
              {members.data.data.map((m) => {
                const s = m.abonnement_en_cours
                return (
                  <tr key={m.id} className="cursor-pointer" onClick={() => navigate(`/membres/${m.id}`)}>
                    <Td>
                      <Link to={`/membres/${m.id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <Avatar url={m.photo_url} name={m.nom_complet} size="sm" />
                        <span>
                          <span className="block font-bold text-slate-900 dark:text-white">{m.nom_complet}</span>
                          <span className="text-xs text-slate-400">N° {String(m.id).padStart(5, '0')}</span>
                        </span>
                        {m.statut === 'archive' && <Badge>Archivé</Badge>}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap text-slate-600 dark:text-slate-300">{m.telephone_affiche}</Td>
                    <Td>
                      {s?.statut === 'suspendu' ? (
                        <Badge tone="amber">Suspendu</Badge>
                      ) : s ? (
                        <Badge tone="green">Actif · jusqu'au {date(m.couvert_jusqu_au)}</Badge>
                      ) : (
                        <Badge tone="red">Aucun abonnement</Badge>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-slate-500">{date(m.date_inscription)}</Td>
                    <Td><ChevronRight className="size-4 text-slate-300" /></Td>
                  </tr>
                )
              })}
            </Table>
          )}
          {members.data?.meta && <Pagination page={page} lastPage={members.data.meta.last_page} onChange={setPage} />}
        </div>
      </Card>
    </div>
  )
}
