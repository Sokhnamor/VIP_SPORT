import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { MemberSearch } from '../../components/MemberSearch'
import { Alert, ButtonLink, Card, PageHeader, StatCard } from '../../components/ui'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { fcfa, time } from '../../lib/format'
import type { CashSession } from '../../lib/types'

/** Accueil réception : recherche membre et actions principales. */
export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const cash = useQuery({ queryKey: ['cash', 'current'], queryFn: () => api<{ data: CashSession | null }>('cash-sessions/current').then((r) => r.data) })
  const presences = useQuery({
    queryKey: ['presences', 'today'],
    queryFn: () => api<{ total: number; presents: number }>('presences/today'),
    refetchInterval: 30_000,
  })

  return (
    <div className="space-y-6">
      <PageHeader title={`Bonjour ${user?.nom.split(' ')[0] ?? ''}`} subtitle="Accueil de la salle" />

      {cash.data === null && (
        <Alert tone="amber" title="Caisse fermée">
          Ouvrez votre session de caisse avant tout encaissement.{' '}
          <a href="/caisse" onClick={(e) => { e.preventDefault(); navigate('/caisse') }} className="font-bold underline">Ouvrir la caisse</a>
        </Alert>
      )}
      {cash.data?.oubli_cloture && (
        <Alert title="Session de caisse d'un jour précédent">Clôturez-la puis ouvrez une nouvelle session.</Alert>
      )}

      <Card title="Rechercher un membre">
        <MemberSearch autoFocus onSelect={(m) => navigate(`/membres/${m.id}`)} />
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ButtonLink to="/membres/nouveau" size="lg" variant="secondary">+ Nouveau membre</ButtonLink>
        <ButtonLink to="/vente" size="lg">Vendre un abonnement</ButtonLink>
        <ButtonLink to="/vente?type=seance" size="lg">Vendre une séance</ButtonLink>
        <ButtonLink to="/caisse" size="lg" variant="secondary">Session de caisse</ButtonLink>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Ma caisse"
          value={cash.data ? 'Ouverte' : 'Fermée'}
          tone={cash.data ? 'green' : 'amber'}
          hint={cash.data ? `depuis ${time(cash.data.ouverte_at)}` : undefined}
        />
        <StatCard label="Espèces attendues" value={cash.data?.totaux ? fcfa(cash.data.totaux.especes_attendues) : '—'} hint={cash.data?.totaux ? `${cash.data.totaux.nombre_paiements} encaissement(s)` : undefined} />
        <StatCard label="Entrées aujourd'hui" value={presences.data?.total ?? '—'} hint={presences.data ? `${presences.data.presents} présent(s) actuellement` : undefined} />
      </div>
    </div>
  )
}
