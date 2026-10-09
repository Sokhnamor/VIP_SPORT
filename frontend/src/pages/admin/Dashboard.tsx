import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { BarSeries } from '../../components/BarSeries'
import { Alert, Card, Empty, Loading, PageHeader, StatCard, Table, Td } from '../../components/ui'
import { api, errorMessage } from '../../lib/api'
import { date, dateTime, fcfa, fcfaSigned } from '../../lib/format'
import type { Breakdown, Revenue } from '../../lib/types'

type DashboardData = {
  date: string
  recettes_jour: Revenue
  recettes_mois: Revenue
  par_mode_jour: Breakdown[]
  entrees_jour: number
  membres_actifs: number
  expirent_bientot: { member_id: number; nom: string; telephone: string; couvert_jusqu_au: string; jours_restants: number }[]
  ecarts_caisse: { id: number; employe: string; fermee_at: string; ecart: number; motif_ecart: string | null; commentaire_admin: string | null }[]
  recettes_30j: { date: string; net: number }[]
  frequentation_jour: { heure: string; entrees: number }[]
  frequentation_30j: { heure: string; entrees: number }[]
  alertes: {
    expirent_bientot: number
    expires_recemment: number
    caisses_non_cloturees: number
    ecarts_caisse: number
    refus_scan: { total: number; refus: number; taux: number | null; anormal: boolean }
    entrees_manuelles_7j: number
    depenses_en_attente: number
  }
}

/** Tableau de bord du patron : recettes, entrées, membres actifs, alertes, tendances. */
export default function Dashboard() {
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api<{ data: DashboardData }>('dashboard').then((r) => r.data), refetchInterval: 60_000 })

  if (q.isLoading) return <Loading />
  if (!q.data) return <Alert>{errorMessage(q.error)}</Alert>
  const d = q.data
  const a = d.alertes

  const serie30 = d.recettes_30j.map((r) => ({ jour: date(r.date).slice(0, 5), net: r.net }))
  // Fréquentation : heures d'ouverture plausibles (5h–23h) pour garder un graphique lisible.
  const heures = d.frequentation_30j.slice(5, 24)

  const warnings = [
    a.caisses_non_cloturees > 0 && { text: `${a.caisses_non_cloturees} session(s) de caisse non clôturée(s) d'un jour précédent`, to: '/admin/alertes' },
    a.ecarts_caisse > 0 && { text: `${a.ecarts_caisse} clôture(s) avec écart sur 30 jours`, to: '/admin/caisses' },
    a.refus_scan.anormal && { text: `Taux de refus au scan anormal aujourd'hui : ${a.refus_scan.taux} % (${a.refus_scan.refus}/${a.refus_scan.total})`, to: '/admin/acces' },
    a.entrees_manuelles_7j > 0 && { text: `${a.entrees_manuelles_7j} entrée(s) manuelle(s) sur 7 jours`, to: '/admin/alertes' },
    a.depenses_en_attente > 0 && { text: `${a.depenses_en_attente} dépense(s) en attente de validation`, to: '/depenses' },
  ].filter(Boolean) as { text: string; to: string }[]

  return (
    <div className="space-y-5">
      <PageHeader title="Tableau de bord" subtitle={`Aujourd'hui ${date(d.date)}`} />

      {warnings.length > 0 && (
        <Alert tone="amber" title="À vérifier">
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {warnings.map((w) => (
              <li key={w.text}><Link to={w.to} className="underline">{w.text}</Link></li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Recettes du jour"
          value={fcfa(d.recettes_jour.net)}
          hint={<>{d.recettes_jour.nombre_paiements} paiement(s){d.recettes_jour.annulations > 0 && <> · −{fcfa(d.recettes_jour.annulations)} annulés</>}</>}
        />
        <StatCard label="Recettes du mois" value={fcfa(d.recettes_mois.net)} hint={`${d.recettes_mois.nombre_paiements} paiement(s)`} />
        <StatCard label="Entrées du jour" value={d.entrees_jour} />
        <StatCard label="Membres actifs" value={d.membres_actifs} hint={`${a.expirent_bientot} expirent bientôt`} />
      </div>

      {d.par_mode_jour.length > 0 && (
        <Card title="Encaissé aujourd'hui, par mode">
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            {d.par_mode_jour.map((m) => (
              <p key={m.cle}><span className="text-slate-500 dark:text-slate-400">{m.libelle} :</span> <strong>{fcfa(m.net)}</strong> <span className="text-sm text-slate-500">({m.nombre})</span></p>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Recettes nettes — 30 derniers jours">
          <BarSeries data={serie30} xKey="jour" yKey="net" valueLabel="Recettes nettes" format={fcfa} />
        </Card>
        <Card title="Fréquentation par heure — 30 derniers jours">
          <BarSeries data={heures} xKey="heure" yKey="entrees" valueLabel="Entrées" format={(v) => `${v} entrée(s)`} />
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Abonnements expirant bientôt" actions={<Link to="/admin/alertes" className="font-semibold text-brand-700 hover:underline dark:text-brand-500">Tout voir</Link>}>
          {d.expirent_bientot.length === 0 ? <Empty>Aucun abonnement n'expire prochainement.</Empty> : (
            <Table head={['Membre', 'Fin', 'Jours restants']}>
              {d.expirent_bientot.map((r) => (
                <tr key={r.member_id}>
                  <Td><Link to={`/membres/${r.member_id}`} className="font-semibold hover:underline">{r.nom}</Link></Td>
                  <Td>{date(r.couvert_jusqu_au)}</Td>
                  <Td>{r.jours_restants}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
        <Card title="Écarts de caisse (30 jours)" actions={<Link to="/admin/caisses" className="font-semibold text-brand-700 hover:underline dark:text-brand-500">Toutes les caisses</Link>}>
          {d.ecarts_caisse.length === 0 ? <Empty>Aucun écart de caisse.</Empty> : (
            <Table head={['Session', 'Employé', 'Clôture', 'Écart', 'Motif']}>
              {d.ecarts_caisse.map((s) => (
                <tr key={s.id}>
                  <Td><Link to={`/caisse/${s.id}`} className="font-semibold hover:underline">#{s.id}</Link></Td>
                  <Td>{s.employe}</Td>
                  <Td className="whitespace-nowrap">{dateTime(s.fermee_at)}</Td>
                  <Td className="font-bold whitespace-nowrap text-red-600">{fcfaSigned(s.ecart)}</Td>
                  <Td>{s.motif_ecart}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </div>
  )
}
