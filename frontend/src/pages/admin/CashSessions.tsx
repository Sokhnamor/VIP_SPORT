import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { SessionsTable } from '../reception/Cash'
import { Card, Empty, Loading, PageHeader, Pagination } from '../../components/ui'
import { api, qs } from '../../lib/api'
import type { CashSession, Paginated } from '../../lib/types'

/** Toutes les sessions de caisse et leurs écarts (l'admin commente, ne modifie jamais). */
export default function CashSessions() {
  const [page, setPage] = useState(1)
  const [avecEcart, setAvecEcart] = useState(false)
  const sessions = useQuery({
    queryKey: ['cash', 'all', page, avecEcart],
    queryFn: () => api<Paginated<CashSession>>('cash-sessions' + qs({ page, avec_ecart: avecEcart || undefined })),
  })

  return (
    <div>
      <PageHeader eyebrow="Contrôle" title="Sessions de caisse" subtitle="Toutes les clôtures et leurs écarts. Ouvrez une session pour la commenter." />
      <Card>
        <label className="mb-4 flex min-h-11 items-center gap-2 font-medium">
          <input type="checkbox" className="size-5" checked={avecEcart} onChange={(e) => { setAvecEcart(e.target.checked); setPage(1) }} />
          Seulement les clôtures avec écart
        </label>
        {sessions.isLoading && <Loading />}
        {sessions.data?.data.length === 0 && <Empty>Aucune session.</Empty>}
        {sessions.data && sessions.data.data.length > 0 && <SessionsTable sessions={sessions.data.data} showEmployee />}
        {sessions.data?.meta && <Pagination page={page} lastPage={sessions.data.meta.last_page} onChange={setPage} />}
      </Card>
    </div>
  )
}
