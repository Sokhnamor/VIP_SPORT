import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { cx } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { toggleTheme } from '../lib/theme'
import type { Settings } from '../lib/types'

type NavItem = { to: string; label: string; end?: boolean }

const reception: NavItem[] = [
  { to: '/', label: 'Accueil', end: true },
  { to: '/membres', label: 'Membres' },
  { to: '/vente', label: 'Vendre' },
  { to: '/caisse', label: 'Caisse' },
  { to: '/recus', label: 'Reçus' },
  { to: '/presences', label: 'Présences' },
  { to: '/depenses', label: 'Dépenses' },
]

const admin: NavItem[] = [
  { to: '/admin', label: 'Tableau de bord', end: true },
  { to: '/admin/alertes', label: 'Alertes' },
  { to: '/admin/rapports', label: 'Rapports' },
  { to: '/admin/caisses', label: 'Caisses' },
  { to: '/admin/acces', label: 'Journal des accès' },
  { to: '/admin/formules', label: 'Formules' },
  { to: '/admin/utilisateurs', label: 'Utilisateurs' },
  { to: '/admin/audit', label: 'Audit' },
  { to: '/admin/parametres', label: 'Paramètres' },
]

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api<{ data: Settings }>('settings').then((r) => r.data) })

  const sections = user?.role === 'admin' ? [{ title: 'Réception', items: reception }, { title: 'Administration', items: admin }] : [{ title: 'Réception', items: reception }]

  const onLogout = async () => {
    await logout()
    navigate('/connexion')
  }

  const nav = (
    <nav className="space-y-6">
      {sections.map((section) => (
        <div key={section.title}>
          {sections.length > 1 && <p className="mb-2 px-3 text-xs font-bold tracking-wider text-slate-400 uppercase">{section.title}</p>}
          <ul className="space-y-1">
            {section.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    cx(
                      'flex min-h-11 items-center rounded-xl px-3 font-semibold transition',
                      isActive ? 'bg-brand-600 text-white' : 'text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )

  return (
    <div className="min-h-dvh lg:flex">
      {/* Barre latérale (ordinateur) */}
      <aside className="no-print hidden w-64 shrink-0 border-r border-slate-200 bg-white p-4 lg:block dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-6 px-3 text-xl font-extrabold text-brand-700 dark:text-brand-500">{settings.data?.nom_salle ?? 'GymManager'}</p>
        {nav}
      </aside>

      <div className="min-w-0 flex-1">
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          <button className="min-h-11 rounded-xl px-3 font-semibold ring-1 ring-slate-300 lg:hidden dark:ring-slate-700" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>
            ☰ Menu
          </button>
          <p className="truncate font-bold lg:hidden">{settings.data?.nom_salle ?? 'GymManager'}</p>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-slate-600 sm:inline dark:text-slate-400">
              {user?.nom} · {user?.role_libelle}
            </span>
            <button onClick={() => toggleTheme()} className="min-h-11 rounded-xl px-3 text-lg hover:bg-slate-200 dark:hover:bg-slate-800" aria-label="Basculer le mode sombre" title="Mode sombre">
              ◐
            </button>
            <button onClick={onLogout} className="min-h-11 rounded-xl px-3 font-semibold text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950">
              Déconnexion
            </button>
          </div>
        </header>

        {menuOpen && <div className="no-print border-b border-slate-200 bg-white p-4 lg:hidden dark:border-slate-800 dark:bg-slate-900">{nav}</div>}

        <main className="mx-auto max-w-7xl p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
