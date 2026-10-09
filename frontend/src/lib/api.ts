/**
 * Client HTTP de l'API Laravel (/api/v1).
 * Authentification Sanctum par cookies de session : le cookie XSRF-TOKEN est renvoyé dans
 * l'en-tête X-XSRF-TOKEN à chaque requête qui modifie des données.
 * Aucune règle métier ici : le serveur décide, le front affiche.
 */

export class ApiError extends Error {
  status: number
  code?: string
  errors?: Record<string, string[]>
  context?: Record<string, unknown>

  constructor(status: number, message: string, data?: { code?: string; errors?: Record<string, string[]>; context?: Record<string, unknown> }) {
    super(message)
    this.status = status
    this.code = data?.code
    this.errors = data?.errors
    this.context = data?.context
  }

  /** Premier message d'erreur d'un champ. */
  field(name: string): string | undefined {
    return this.errors?.[name]?.[0]
  }
}

export const AUTH_EXPIRED_EVENT = 'gym:auth-expired'

function getCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((row) => row.startsWith(name + '='))
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null
}

async function ensureCsrfCookie(force = false): Promise<void> {
  if (force || !getCookie('XSRF-TOKEN')) {
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Envoi multipart (photo, justificatif) */
  form?: FormData
  signal?: AbortSignal
}

export async function api<T = unknown>(path: string, options: Options = {}, retried = false): Promise<T> {
  const method = options.method ?? (options.body || options.form ? 'POST' : 'GET')
  if (method !== 'GET') {
    await ensureCsrfCookie()
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  }
  const xsrf = getCookie('XSRF-TOKEN')
  if (xsrf) headers['X-XSRF-TOKEN'] = xsrf

  let body: BodyInit | undefined
  if (options.form) {
    body = options.form
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }

  let response: Response
  try {
    response = await fetch(path.startsWith('/') ? path : `/api/v1/${path}`, {
      method,
      headers,
      body,
      credentials: 'include',
      signal: options.signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError(0, 'Connexion au serveur impossible. Vérifiez le réseau.', { code: 'RESEAU' })
  }

  // Jeton CSRF expiré : on le renouvelle et on réessaie une fois.
  if (response.status === 419 && !retried) {
    await ensureCsrfCookie(true)
    return api<T>(path, options, true)
  }

  const isJson = response.headers.get('content-type')?.includes('application/json')
  const data = isJson ? await response.json() : null

  if (!response.ok) {
    if (response.status === 401 && !path.includes('auth/login')) {
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: data?.code }))
    }
    throw new ApiError(response.status, data?.message ?? `Erreur ${response.status}`, data ?? undefined)
  }

  return data as T
}

/** Construit une query string en ignorant les valeurs vides. */
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value))
    }
  }
  const s = search.toString()
  return s ? `?${s}` : ''
}

/** Ouvre un document (PDF, CSV) servi par l'API dans un nouvel onglet (cookies de session inclus). */
export function openDocument(path: string): void {
  window.open(path.startsWith('/') ? path : `/api/v1/${path}`, '_blank', 'noopener')
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.errors) {
      const first = Object.values(error.errors)[0]?.[0]
      if (first) return first
    }
    return error.message
  }
  return 'Une erreur inattendue est survenue.'
}
