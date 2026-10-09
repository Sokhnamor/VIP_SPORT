import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { homeFor, useAuth } from '../lib/auth'
import type { Role } from '../lib/types'
import { Loading } from './ui'

/**
 * Garde de navigation : confort d'affichage uniquement. Les droits réels sont vérifiés
 * par l'API (une requête non autorisée reçoit toujours 403 du serveur).
 */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Loading />
  if (!user) return <Navigate to="/connexion" replace state={{ from: location.pathname }} />
  if (user.doit_changer_mdp) return <Navigate to="/mot-de-passe" replace />
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />

  return <>{children}</>
}
