import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, ApiError, AUTH_EXPIRED_EVENT } from './api'
import type { Role, User } from './types'

type AuthState = {
  user: User | null
  loading: boolean
  /** Message affiché sur l'écran de connexion (ex. session expirée). */
  notice: string | null
  login: (identifiant: string, motDePasse: string) => Promise<User>
  logout: () => Promise<void>
  setUser: (user: User) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    api<{ data: User }>('auth/me')
      .then((r) => setUserState(r.data))
      .catch(() => setUserState(null))
      .finally(() => setLoading(false))
  }, [])

  // Session expirée côté serveur (inactivité, compte désactivé) : retour à la connexion.
  useEffect(() => {
    const onExpired = (event: Event) => {
      const code = (event as CustomEvent).detail
      setNotice(
        code === 'SESSION_EXPIREE'
          ? 'Session expirée après inactivité. Reconnectez-vous.'
          : code === 'COMPTE_DESACTIVE'
            ? 'Votre compte a été désactivé.'
            : null,
      )
      setUserState(null)
      queryClient.clear()
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  }, [queryClient])

  const login = useCallback(async (identifiant: string, motDePasse: string) => {
    const r = await api<{ data: User }>('auth/login', { body: { identifiant, mot_de_passe: motDePasse } })
    setNotice(null)
    setUserState(r.data)
    return r.data
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('auth/logout', { method: 'POST' })
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) throw e
    }
    setUserState(null)
    queryClient.clear()
  }, [queryClient])

  return (
    <AuthContext.Provider value={{ user, loading, notice, login, logout, setUser: setUserState }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth hors AuthProvider')
  return ctx
}

/** Page d'accueil selon le rôle : patron → tableau de bord, scanner → scan, réception → accueil. */
export function homeFor(role: Role): string {
  return role === 'admin' ? '/admin' : role === 'scanner' ? '/scan' : '/'
}
