import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, BarChart3, CalendarClock, CalendarDays, CircleDollarSign, Clock, DoorOpen, Scale, Users } from 'lucide-react'
import { Link } from 'react-router'
import { BarSeries } from '../../components/BarSeries'
import { Alert, Avatar, Card, Empty, Loading, PageHeader, StatCard, Table, Td, cx } from '../../components/ui'
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

const MODE_COLORS: Record<string, string> = { especes: 'bg-emerald-500', wave: 'bg-sky-500', orange_money: 'bg-orange-500', autre: 'bg-slate-400' }

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
  const totalJour = d.par_mode_jour.reduce((s, m) => s + Math.max(0, m.net), 0)

  const warnings = [
    a.caisses_non_cloturees > 0 && { text: `${a.caisses_non_cloturees} session(s) de caisse non clôturée(s) d'un jour précédent`, to: '/admin/alertes' },
    a.ecarts_caisse > 0 && { text: `${a.ecarts_caisse} clôture(s) avec écart sur 30 jours`, to: '/admin/caisses' },
    a.refus_scan.anormal && { text: `Taux de refus au scan anormal aujourd'hui : ${a.refus_scan.taux} % (${a.refus_scan.refus}/${a.refus_scan.total})`, to: '/admin/acces' },
    a.entrees_manuelles_7j > 0 && { text: `${a.entrees_manuelles_7j} entrée(s) manuelle(s) sur 7 jours`, to: '/admin/alertes' },
    a.depenses_en_attente > 0 && { text: `${a.depenses_en_attente} dépense(s) en attente de validation`, to: '/depenses' },
  ].filter(Boolean) as { text: string; to: string }[]

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Pilotage" title="Tableau de bord" subtitle={`Situation au ${date(d.date)}, mise à jour chaque minute.`} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          featured
          icon={CircleDollarSign}
          label="Recettes du jour"
          value={fcfa(d.recettes_jour.net)}
          hint={<>{d.recettes_jour.nombre_paiements} paiement(s){d.recettes_jour.annulations > 0 && <> · −{fcfa(d.recettes_jour.annulations)} annulés</>}</>}
        />
        <StatCard icon={CalendarDays} label="Recettes du mois" value={fcfa(d.recettes_mois.net)} hint={`${d.recettes_mois.nombre_paiements} paiement(s)`} />
        <StatCard icon={DoorOpen} tone="green" label="Entrées du jour" value={d.entrees_jour} hint="Scans acceptés" />
        <StatCard icon={Users} label="Membres actifs" value={d.membres_actifs} hint={`${a.expirent_bientot} expirent bientôt`} />
      </div>

      {warnings.length > 0 && (
        <section className="animate-rise rounded-card border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50/40 p-5 dark:border-amber-500/20 dark:from-amber-500/10 dark:to-transparent">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600"><AlertTriangle className="size-5" /></span>
            <h2 className="font-bold text-amber-950 dark:text-amber-100">À vérifier aujourd'hui</h2>
          </div>
          <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {warnings.map((w) => (
              <li key={w.text}>
                <Link to={w.to} className="group flex items-center justify-between gap-3 rounded-xl bg-white/70 px-4 py-3 text-sm font-semibold text-amber-950 ring-1 ring-amber-200/70 transition hover:bg-white dark:bg-white/5 dark:text-amber-100 dark:ring-amber-500/20">
                  {w.text}
                  <ArrowRight className="size-4 shrink-0 transition group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Recettes nettes — 30 jours" icon={BarChart3} className="xl:col-span-2">
          <BarSeries data={serie30} xKey="jour" yKey="net" valueLabel="Recettes nettes" format={fcfa} />
        </Card>
        <Card title="Encaissé aujourd'hui" icon={CircleDollarSign}>
          {d.par_mode_jour.length === 0 ? <Empty>Aucun encaissement aujourd'hui.</Empty> : (
            <div className="space-y-5">
              <p className="tabular text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{fcfa(d.recettes_jour.net)}</p>
              {/* Barre de répartition par mode, avec libellés (jamais la couleur seule) */}
              <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                {d.par_mode_jour.filter((m) => m.net > 0).map((m) => (
                  <span key={m.cle} className={cx('h-full first:rounded-l-full last:rounded-r-full', MODE_COLORS[m.cle] ?? 'bg-slate-400')} style={{ width: `${(m.net / Math.max(1, totalJour)) * 100}%` }} />
                ))}
              </div>
              <ul className="space-y-3">
                {d.par_mode_jour.map((m) => (
                  <li key={m.cle} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2.5 font-semibold text-slate-700 dark:text-slate-200">
                      <span className={cx('size-2.5 rounded-full', MODE_COLORS[m.cle] ?? 'bg-slate-400')} />
                      {m.libelle}
                      <span className="font-normal text-slate-400">· {m.nombre}</span>
                    </span>
                    <span className="tabular font-bold text-slate-900 dark:text-white">{fcfa(m.net)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Affluence par heure — 30 jours" icon={Clock} className="xl:col-span-2">
          <BarSeries data={heures} xKey="heure" yKey="entrees" valueLabel="Entrées" format={(v) => `${v} entrée(s)`} />
        </Card>
        <Card title="Expirent bientôt" icon={CalendarClock} actions={<Link to="/admin/alertes" className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">Tout voir</Link>}>
          {d.expirent_bientot.length === 0 ? <Empty>Aucun abonnement n'expire prochainement.</Empty> : (
            <ul className="-my-2 divide-y divide-slate-100 dark:divide-white/5">
              {d.expirent_bientot.map((r) => (
                <li key={r.member_id}>
                  <Link to={`/membres/${r.member_id}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                    <Avatar url={null} name={r.nom} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-slate-900 dark:text-white">{r.nom}</span>
                      <span className="text-xs text-slate-500">fin le {date(r.couvert_jusqu_au)}</span>
                    </span>
                    <span className={cx('rounded-lg px-2 py-1 text-xs font-bold', r.jours_restants <= 3 ? 'bg-orange-500/10 text-orange-600' : 'bg-slate-500/10 text-slate-600 dark:text-slate-300')}>J-{r.jours_restants}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Écarts de caisse — 30 jours" icon={Scale} actions={<Link to="/admin/caisses" className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">Toutes les caisses</Link>}>
        {d.ecarts_caisse.length === 0 ? <Empty>Aucun écart de caisse. 👌</Empty> : (
          <Table head={['Session', 'Employé', 'Clôture', 'Écart', 'Motif']}>
            {d.ecarts_caisse.map((s) => (
              <tr key={s.id}>
                <Td><Link to={`/caisse/${s.id}`} className="font-bold text-slate-900 hover:underline dark:text-white">#{s.id}</Link></Td>
                <Td className="font-medium">{s.employe}</Td>
                <Td className="whitespace-nowrap text-slate-500">{dateTime(s.fermee_at)}</Td>
                <Td className="tabular font-bold whitespace-nowrap text-red-600 dark:text-red-400">{fcfaSigned(s.ecart)}</Td>
                <Td className="text-slate-600 dark:text-slate-300">{s.motif_ecart}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}
