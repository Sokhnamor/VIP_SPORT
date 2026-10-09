import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Avatar, Badge, Card, Empty, Loading, PageHeader, StatCard, Table, Td } from '../../components/ui'
import { api } from '../../lib/api'
import { time } from '../../lib/format'

type PresenceRow = {
  id: number
  membre: { id: number; nom_complet: string; photo_url: string | null } | null
  ticket: string | null
  entree_at: string
  sortie_at: string | null
  cloture_auto: boolean
}

/** Présences du jour, rafraîchies automatiquement. */
export default function Presences() {
  const presences = useQuery({
    queryKey: ['presences', 'today', 'list'],
    queryFn: () => api<{ data: PresenceRow[]; total: number; presents: number }>('presences/today'),
    refetchInterval: 15_000,
  })

  return (
    <div className="space-y-5">
      <PageHeader title="Présences du jour" subtitle="Mise à jour automatique toutes les 15 secondes" />
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <StatCard label="Entrées" value={presences.data?.total ?? '—'} />
        <StatCard label="Présents" value={presences.data?.presents ?? '—'} tone="green" />
      </div>
      <Card>
        {presences.isLoading && <Loading />}
        {presences.data?.data.length === 0 && <Empty>Personne n'est encore entré aujourd'hui.</Empty>}
        {presences.data && presences.data.data.length > 0 && (
          <Table head={['Entrée', 'Personne', 'Sortie']}>
            {presences.data.data.map((p) => (
              <tr key={p.id}>
                <Td className="font-semibold">{time(p.entree_at)}</Td>
                <Td>
                  {p.membre ? (
                    <Link to={`/membres/${p.membre.id}`} className="flex items-center gap-3 hover:underline">
                      <Avatar url={p.membre.photo_url} name={p.membre.nom_complet} size="sm" />
                      {p.membre.nom_complet}
                    </Link>
                  ) : (
                    <span>Ticket {p.ticket}</span>
                  )}
                </Td>
                <Td>{p.sortie_at ? `${time(p.sortie_at)}${p.cloture_auto ? ' (auto)' : ''}` : <Badge tone="green">Présent</Badge>}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}
