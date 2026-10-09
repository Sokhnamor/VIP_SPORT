import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Link } from 'react-router'

/** Composants d'interface : boutons larges, contrastes élevés, messages clairs. */

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'warning'

const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600 disabled:bg-brand-600/50',
  secondary: 'bg-white text-slate-900 ring-1 ring-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-600 dark:hover:bg-slate-700',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600 disabled:bg-red-600/50',
  warning: 'bg-amber-500 text-slate-950 hover:bg-amber-400',
  ghost: 'text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'md' | 'lg'; loading?: boolean }

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
        size === 'lg' ? 'min-h-14 px-6 text-lg' : 'min-h-11 px-4 text-base',
        variants[variant],
        className,
      )}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  )
}

export function ButtonLink({ to, variant = 'primary', size = 'md', className, children }: { to: string; variant?: Variant; size?: 'md' | 'lg'; className?: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition',
        size === 'lg' ? 'min-h-14 px-6 text-lg' : 'min-h-11 px-4 text-base',
        variants[variant],
        className,
      )}
    >
      {children}
    </Link>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx('animate-spin', className ?? 'size-5')} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export function Field({ label, error, hint, children, required }: { label: string; error?: string; hint?: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-sm font-medium text-red-600 dark:text-red-400">{error}</span>}
    </label>
  )
}

const inputClass =
  'block w-full min-h-11 rounded-xl border-0 bg-white px-3 py-2 text-base text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-600 focus:outline-none disabled:bg-slate-100 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-600 dark:disabled:bg-slate-800'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} {...props} className={cx(inputClass, className)} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} {...props} className={cx(inputClass, 'pr-8', className)}>
      {children}
    </select>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} rows={3} {...props} className={cx(inputClass, className)} />
})

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5 dark:bg-slate-900 dark:ring-slate-800', className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-lg font-bold">{title}</h2>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-slate-600 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

type Tone = 'green' | 'red' | 'amber' | 'slate' | 'blue' | 'yellow'
const tones: Record<Tone, string> = {
  green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
  amber: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200',
  yellow: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900/50 dark:text-yellow-200',
  slate: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  blue: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200',
}

export function Badge({ tone = 'slate', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap', tones[tone])}>{children}</span>
}

/** Couleur du badge d'un statut d'abonnement / ticket / dépense / scan. */
export function statusTone(statut: string): Tone {
  switch (statut) {
    case 'actif':
    case 'valide':
    case 'validee':
    case 'ACCEPTE':
    case 'cloturee':
      return 'green'
    case 'a_venir':
    case 'ouverte':
      return 'blue'
    case 'en_attente':
    case 'ACCEPTE_ALERTE':
      return 'amber'
    case 'DEJA_SCANNE':
      return 'yellow'
    case 'utilise':
    case 'archive':
      return 'slate'
    default:
      return 'red'
  }
}

export function Alert({ tone = 'red', children, title }: { tone?: 'red' | 'amber' | 'green' | 'blue'; children: ReactNode; title?: string }) {
  const styles = {
    red: 'bg-red-50 text-red-900 ring-red-200 dark:bg-red-950/60 dark:text-red-100 dark:ring-red-900',
    amber: 'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-100 dark:ring-amber-900',
    green: 'bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-100 dark:ring-emerald-900',
    blue: 'bg-sky-50 text-sky-900 ring-sky-200 dark:bg-sky-950/60 dark:text-sky-100 dark:ring-sky-900',
  }[tone]
  return (
    <div role={tone === 'red' ? 'alert' : 'status'} className={cx('rounded-xl p-3 ring-1', styles)}>
      {title && <p className="font-bold">{title}</p>}
      <div>{children}</div>
    </div>
  )
}

export function Loading({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 p-6 text-slate-600 dark:text-slate-400">
      <Spinner /> {label}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border-2 border-dashed border-slate-300 p-6 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">{children}</p>
}

export function StatCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'green' | 'red' | 'amber' }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      <p className={cx('mt-1 text-2xl font-extrabold sm:text-3xl', tone === 'red' && 'text-red-600', tone === 'green' && 'text-emerald-600', tone === 'amber' && 'text-amber-600')}>{value}</p>
      {hint && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  )
}

/** Tableau responsive : défilement horizontal interne sur petit écran (jamais la page entière). */
export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {head.map((h, i) => (
              <th key={i} className="px-3 py-2 font-semibold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{children}</tbody>
      </table>
    </div>
  )
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx('px-3 py-2.5 align-top', className)}>{children}</td>
}

export function Pagination({ page, lastPage, onChange }: { page: number; lastPage: number; onChange: (page: number) => void }) {
  if (lastPage <= 1) return null
  return (
    <div className="mt-4 flex items-center justify-between gap-2">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>← Précédent</Button>
      <span className="text-sm text-slate-600 dark:text-slate-400">Page {page} / {lastPage}</span>
      <Button variant="secondary" disabled={page >= lastPage} onClick={() => onChange(page + 1)}>Suivant →</Button>
    </div>
  )
}

/** Fenêtre modale accessible (Échap pour fermer). */
export function Modal({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="-m-2 rounded-lg p-2 text-2xl leading-none text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fermer">×</button>
        </div>
        {children}
        {footer && <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

/** Photo de membre ou initiales. */
export function Avatar({ url, name, size = 'md' }: { url: string | null | undefined; name: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const dims = { sm: 'size-9 text-sm', md: 'size-12 text-base', lg: 'size-24 text-2xl', xl: 'size-56 text-6xl' }[size]
  const initials = name.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  return url ? (
    <img src={url} alt={name} className={cx(dims, 'shrink-0 rounded-2xl object-cover ring-1 ring-slate-200 dark:ring-slate-700')} />
  ) : (
    <span className={cx(dims, 'inline-flex shrink-0 items-center justify-center rounded-2xl bg-slate-200 font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>{initials}</span>
  )
}
