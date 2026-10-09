import { useQuery } from '@tanstack/react-query'
import {
  BarChart3, Bell, CalendarCheck, FileText, Home, LayoutDashboard, LogOut, Menu, Moon, Receipt, ScanLine, ScrollText,
  Settings, ShieldCheck, ShoppingCart, Sun, Tag, UserCog, Users, Vault, Wallet, X, type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { cx } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { toggleTheme } from '../lib/theme'
import type { Settings as SettingsType } from '../lib/types'

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean }

const reception: NavItem[] = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/membres', label: 'Membres', icon: Users },
  { to: '/vente', label: 'Vendre', icon: ShoppingCart },
  { to: '/caisse', label: 'Ma caisse', icon: Wallet },
  { to: '/recus', label: 'Reçus', icon: Receipt },
  { to: '/presences', label: 'Présences', icon: CalendarCheck },
  { to: '/depenses', label: 'Dépenses', icon: FileText },
]

const admin: NavItem[] = [
  { to: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/admin/alertes', label: 'Alertes', icon: Bell },
  { to: '/admin/rapports', label: 'Rapports', icon: BarChart3 },
  { to: '/admin/caisses', label: 'Caisses', icon: Vault },
  { to: '/admin/acces', label: 'Journal des accès', icon: ScanLine },
  { to: '/admin/formules', label: 'Formules', icon: Tag },
  { to: '/admin/utilisateurs', label: 'Utilisateurs', icon: UserCog },
  { to: '/admin/audit', label: 'Audit', icon: ScrollText },
  { to: '/admin/parametres', label: 'Paramètres', icon: Settings },
]

/** Logo : pastille dégradée + nom de la salle. */
export function Brand({ name, compact }: { name: string; compact?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <span className="relative flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient shadow-glow">
        <ScanLine className="size-5 text-white" strokeWidth={2.4} />
      </span>
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[15px] font-extrabold text-white">{name}</span>
          <span className="block text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase">{name === 'GymManager' ? 'Gestion de salle' : 'GymManager'}</span>
        </span>
      )}
    </span>
  )
}

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api<{ data: SettingsType }>('settings').then((r) => r.data) })
  const gymName = settings.data?.nom_salle ?? 'GymManager'


  const sections = user?.role === 'admin'
    ? [{ title: 'Pilotage', items: admin }, { title: 'Réception', items: reception }]
    : [{ title: 'Réception', items: reception }]

  const onLogout = async () => {
    await logout()
    navigate('/connexion')
  }

  const initials = (user?.nom ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link to="/" className="mb-7 px-2">
        <Brand name={gymName} />
      </Link>

      <nav className="-mr-2 flex-1 space-y-5 overflow-y-auto pr-2 [scrollbar-width:thin]">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="mb-2 px-3 text-[11px] font-bold tracking-[0.16em] text-slate-500 uppercase">{section.title}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cx(
                        'group relative flex min-h-9 items-center gap-3 rounded-xl px-3 text-[14px] font-semibold transition duration-200',
                        isActive
                          ? 'bg-white/[0.07] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]'
                          : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="absolute top-2 bottom-2 left-0 w-1 rounded-r-full bg-brand-gradient shadow-glow" />}
                        <item.icon className={cx('size-[18px] transition', isActive ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300')} strokeWidth={2.1} />
                        {item.label}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <Link to="/scan" className="mt-4 flex items-center gap-3 rounded-2xl border border-brand-400/20 bg-brand-500/10 px-3 py-2.5 text-sm font-semibold text-brand-300 transition hover:bg-brand-500/15">
        <ScanLine className="size-5" /> Ouvrir le poste de scan
      </Link>

      <div className="mt-2.5 flex items-center gap-3 rounded-2xl bg-white/[0.04] p-2.5 ring-1 ring-white/[0.06]">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-ink-600 to-ink-700 text-sm font-bold text-white">{initials}</span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-bold text-white">{user?.nom}</span>
          <span className="flex items-center gap-1 text-xs text-slate-400">
            {user?.role === 'admin' && <ShieldCheck className="size-3 text-brand-400" />}
            {user?.role_libelle}
          </span>
        </span>
        <button onClick={onLogout} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-red-400" title="Déconnexion" aria-label="Déconnexion">
          <LogOut className="size-[18px]" />
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh lg:pl-[272px]">
      {/* Barre latérale (ordinateur) */}
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-[272px] bg-ink-gradient p-4 lg:block">
        {sidebar}
      </aside>

      {/* Tiroir (mobile / tablette) */}
      {menuOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          {/* Un clic sur un lien du tiroir le referme. */}
          <aside className="absolute inset-y-0 left-0 w-[86%] max-w-[300px] animate-rise bg-ink-gradient p-4 shadow-pop" onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setMenuOpen(false) }}>
            <button onClick={() => setMenuOpen(false)} className="absolute top-4 right-4 rounded-xl p-2 text-slate-400 hover:bg-white/5" aria-label="Fermer le menu">
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200/70 bg-white/70 px-4 backdrop-blur-xl sm:px-6 dark:border-white/[0.06] dark:bg-ink-950/70">
        <button className="-ml-1 rounded-xl p-2.5 text-slate-700 hover:bg-slate-900/5 lg:hidden dark:text-slate-200 dark:hover:bg-white/5" onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu">
          <Menu className="size-5" />
        </button>
        <span className="lg:hidden"><BrandMini name={gymName} /></span>

        <div className="ml-auto flex items-center gap-1.5">
          <span className="mr-2 hidden items-center gap-2 rounded-full bg-slate-900/[0.04] px-3 py-1.5 text-[13px] font-semibold text-slate-600 sm:flex dark:bg-white/5 dark:text-slate-300">
            <CalendarCheck className="size-4 text-brand-600 dark:text-brand-400" />
            {todayLabel()}
          </span>
          <button
            onClick={() => setDark(toggleTheme())}
            className="rounded-xl p-2.5 text-slate-600 transition hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/5"
            aria-label="Basculer le mode sombre"
            title={dark ? 'Mode clair' : 'Mode sombre'}
          >
            {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </button>
          <button onClick={onLogout} className="rounded-xl p-2.5 text-slate-600 transition hover:bg-red-50 hover:text-red-600 lg:hidden dark:text-slate-300 dark:hover:bg-red-500/10" aria-label="Déconnexion">
            <LogOut className="size-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  )
}

/** « Vendredi 9 octobre » : majuscule initiale uniquement (usage français). */
function todayLabel(): string {
  const s = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Dakar', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function BrandMini({ name }: { name: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-xl bg-brand-gradient shadow-glow">
        <ScanLine className="size-4 text-white" strokeWidth={2.4} />
      </span>
      <span className="max-w-[45vw] truncate text-[15px] font-extrabold">{name}</span>
    </span>
  )
}
