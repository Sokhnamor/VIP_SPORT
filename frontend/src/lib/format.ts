/** Formatage d'affichage : FCFA, dates JJ/MM/AAAA (fuseau Africa/Dakar), téléphones +221. */

const TZ = 'Africa/Dakar'

/** 20000 → « 20 000 FCFA » */
export function fcfa(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  const sign = amount < 0 ? '−' : ''
  return sign + Math.abs(Math.round(amount)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA'
}

/** Écart signé : « +2 000 FCFA » / « −5 000 FCFA » */
export function fcfaSigned(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return (amount > 0 ? '+' : '') + fcfa(amount)
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', {
  timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
})
const timeFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })

/** « 2026-10-09 » (date locale) ou ISO → « 09/10/2026 » */
export function date(value: string | null | undefined): string {
  if (!value) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-')
    return `${d}/${m}/${y}`
  }
  return dateFmt.format(new Date(value))
}

export function dateTime(value: string | null | undefined): string {
  return value ? dateTimeFmt.format(new Date(value)) : '—'
}

export function time(value: string | null | undefined): string {
  return value ? timeFmt.format(new Date(value)) : '—'
}

/** Date du jour à Dakar au format AAAA-MM-JJ (pour les filtres). */
export function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
}

export function daysAgoIso(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
}

/** +221771234567 → « +221 77 123 45 67 » */
export function phone(value: string | null | undefined): string {
  if (!value) return '—'
  const m = value.match(/^\+221(\d{2})(\d{3})(\d{2})(\d{2})$/)
  return m ? `+221 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : value
}

export const MODES: Record<string, string> = {
  especes: 'Espèces',
  wave: 'Wave',
  orange_money: 'Orange Money',
  autre: 'Autre',
}

export const CATEGORIES: Record<string, string> = {
  loyer: 'Loyer',
  electricite: 'Électricité',
  eau: 'Eau',
  salaires: 'Salaires',
  materiel: 'Matériel',
  entretien: 'Entretien',
  internet: 'Internet',
  autre: 'Autre',
}

export const ROLES: Record<string, string> = {
  admin: 'Administrateur',
  receptionniste: 'Réceptionniste',
  scanner: 'Poste de scan',
}
