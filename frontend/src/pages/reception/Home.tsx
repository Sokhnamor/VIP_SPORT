import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, CalendarCheck, Coins, Search, Ticket, UserPlus, Users, Wallet, type LucideIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { MemberSearch } from '../../components/MemberSearch'
import { Alert, StatCard, cx } from '../../components/ui'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { fcfa, time } from '../../lib/format'
import type { CashSession } from '../../lib/types'

const actions: { to: string; label: string; text: string; icon: LucideIcon; gradient: string }[] = [
  { to: '/vente', label: 'Vendre un abonnement', text: 'Nouveau ou renouvellement', icon: Coins, gradient: 'from-emerald-500 to-teal-500' },
  { to: '/vente?type=seance', label: 'Vendre une séance', text: 'Ticket du jour, usage unique', icon: Ticket, gradient: 'from-sky-500 to-cyan-500' },
  { to: '/membres/nouveau', label: 'Nouveau membre', text: 'Fiche, photo, téléphone', icon: UserPlus, gradient: 'from-violet-500 to-fuchsia-500' },
  { to: '/caisse', label: 'Session de caisse', text: 'Ouvrir, suivre, clôturer', icon: Wallet, gradient: 'from-amber-500 to-orange-500' },
]

function greeting(): string {
  const h = Number(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Dakar', hour: 'numeric', hour12: false }).format(new Date()))
  return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'
}

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
      {/* Bandeau d'accueil */}
      <section className="relative animate-rise overflow-visible rounded-[1.75rem] bg-ink-gradient p-6 text-white shadow-pop sm:p-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.75rem]">
          <div className="bg-grid absolute inset-0 opacity-60 [mask-image:linear-gradient(to_right,black,transparent)]" />
          <div className="absolute -top-24 right-10 size-72 rounded-full bg-brand-500/25 blur-[90px]" />
        </div>
        <div className="relative grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-brand-300">{greeting()},</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{user?.nom.split(' ')[0]} 👋</h1>
            <p className="mt-2 text-slate-300">Prêt pour l'accueil. Retrouvez un membre en tapant son nom ou son numéro.</p>
          </div>
          <div className="relative">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-300"><Search className="size-4" /> Rechercher un membre</div>
            <div className="[&_input]:border-white/10 [&_input]:bg-white [&_input]:text-slate-900">
              <MemberSearch autoFocus onSelect={(m) => navigate(`/membres/${m.id}`)} />
            </div>
          </div>
        </div>
      </section>

      {cash.data === null && (
        <Alert tone="amber" title="Caisse fermée">
          Ouvrez votre session de caisse avant tout encaissement.{' '}
          <Link to="/caisse" className="font-bold underline underline-offset-2">Ouvrir la caisse →</Link>
        </Alert>
      )}
      {cash.data?.oubli_cloture && <Alert title="Session de caisse d'un jour précédent">Clôturez-la puis ouvrez une nouvelle session.</Alert>}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {actions.map((a, i) => (
          <Link
            key={a.to}
            to={a.to}
            className="group relative animate-rise overflow-hidden rounded-card border border-slate-200/80 bg-white p-4 shadow-card sm:p-5 transition duration-300 hover:-translate-y-1 hover:shadow-pop dark:border-white/[0.06] dark:bg-ink-850"
            style={{ animationDelay: `${80 + i * 60}ms` }}
          >
            <div className={cx('absolute -top-10 -right-10 size-32 rounded-full bg-gradient-to-br opacity-10 blur-2xl transition group-hover:opacity-25', a.gradient)} />
            <span className={cx('flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg', a.gradient)}>
              <a.icon className="size-6" strokeWidth={2.2} />
            </span>
            <p className="mt-4 flex items-center justify-between gap-2 text-[15px] leading-snug font-bold text-slate-900 sm:mt-5 sm:text-[17px] dark:text-white">
              {a.label}
              <ArrowUpRight className="hidden size-5 shrink-0 text-slate-300 sm:block transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-500" />
            </p>
            <p className="mt-1 hidden text-sm text-slate-500 sm:block dark:text-slate-400">{a.text}</p>
          </Link>
        ))}
      </div>

      {/* Indicateurs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          featured
          icon={Wallet}
          label="Ma caisse"
          value={cash.data ? 'Ouverte' : 'Fermée'}
          hint={cash.data ? `Depuis ${time(cash.data.ouverte_at)} · session #${cash.data.id}` : 'Aucune vente possible'}
        />
        <StatCard icon={Coins} label="Espèces attendues" value={cash.data?.totaux ? fcfa(cash.data.totaux.especes_attendues) : '—'} hint={cash.data?.totaux ? `${cash.data.totaux.nombre_paiements} encaissement(s)` : undefined} />
        <StatCard icon={CalendarCheck} tone="green" label="Entrées aujourd'hui" value={presences.data?.total ?? '—'} hint={presences.data ? <span className="inline-flex items-center gap-1.5"><Users className="size-3.5" /> {presences.data.presents} présent(s) actuellement</span> : undefined} />
      </div>
    </div>
  )
}
