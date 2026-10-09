import { AlertTriangle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Info, Inbox, X, XCircle, type LucideIcon } from 'lucide-react'
import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Link } from 'react-router'

/** Composants d'interface : grandes zones tactiles, contrastes élevés, style moderne et sobre. */

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'warning' | 'dark'

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-gradient text-white shadow-glow ring-1 ring-inset ring-white/20 hover:brightness-105 hover:-translate-y-px active:translate-y-0 focus-visible:outline-brand-500',
  secondary:
    'bg-white text-slate-800 ring-1 ring-slate-200 shadow-sm hover:bg-slate-50 hover:ring-slate-300 dark:bg-ink-800 dark:text-slate-100 dark:ring-white/10 dark:hover:bg-ink-700',
  danger: 'bg-red-600 text-white shadow-[0_10px_30px_-12px_rgb(220_38_38/0.7)] hover:bg-red-700 focus-visible:outline-red-600',
  warning: 'bg-amber-400 text-amber-950 shadow-[0_10px_30px_-12px_rgb(245_158_11/0.7)] hover:bg-amber-300',
  dark: 'bg-ink-900 text-white hover:bg-ink-800 dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100',
  ghost: 'text-slate-600 hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white',
}

const sizes = { sm: 'min-h-9 px-3 text-sm gap-1.5', md: 'min-h-11 px-4 text-[15px] gap-2', lg: 'min-h-14 px-6 text-base gap-2.5' }

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: LucideIcon }

export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, className, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center rounded-xl font-semibold whitespace-nowrap transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50',
        sizes[size],
        variants[variant],
        className,
      )}
    >
      {loading ? <Spinner className="size-4" /> : Icon && <Icon className={size === 'lg' ? 'size-5' : 'size-4'} strokeWidth={2.2} />}
      {children}
    </button>
  )
}

export function ButtonLink({ to, variant = 'primary', size = 'md', icon: Icon, className, children }: { to: string; variant?: Variant; size?: 'sm' | 'md' | 'lg'; icon?: LucideIcon; className?: string; children: ReactNode }) {
  return (
    <Link to={to} className={cx('inline-flex items-center justify-center rounded-xl font-semibold whitespace-nowrap transition duration-200', sizes[size], variants[variant], className)}>
      {Icon && <Icon className={size === 'lg' ? 'size-5' : 'size-4'} strokeWidth={2.2} />}
      {children}
    </Link>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx('animate-spin', className ?? 'size-5')} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function Field({ label, error, hint, children, required }: { label: string; error?: string; hint?: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-slate-600 dark:text-slate-300">
        {label}
        {required && <span className="text-brand-600"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1.5 block text-[13px] text-slate-500 dark:text-slate-400">{hint}</span>}
      {error && (
        <span role="alert" className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-red-600 dark:text-red-400">
          <AlertTriangle className="size-3.5 shrink-0" /> {error}
        </span>
      )}
    </label>
  )
}

const inputClass =
  'block w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[15px] text-slate-900 shadow-[inset_0_1px_2px_rgb(16_24_40/0.04)] transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500 dark:border-white/10 dark:bg-ink-850 dark:text-slate-100 dark:hover:border-white/20 dark:disabled:bg-ink-800'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} {...props} className={cx(inputClass, className)} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} {...props} className={cx(inputClass, 'appearance-none pr-10', className)}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400" />
    </div>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} rows={3} {...props} className={cx(inputClass, 'py-2.5', className)} />
})

/** Icône dans une pastille teintée (titres de cartes, indicateurs). */
export function IconTile({ icon: Icon, tone = 'brand', size = 'md' }: { icon: LucideIcon; tone?: Tone | 'brand' | 'violet'; size?: 'sm' | 'md' | 'lg' }) {
  const tones: Record<string, string> = {
    brand: 'bg-brand-gradient text-white shadow-glow',
    green: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
    blue: 'bg-sky-500/12 text-sky-600 dark:text-sky-400',
    amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    yellow: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
    red: 'bg-red-500/12 text-red-600 dark:text-red-400',
    violet: 'bg-violet-500/12 text-violet-600 dark:text-violet-400',
    slate: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
  }
  const dims = { sm: 'size-8 rounded-lg [&>svg]:size-4', md: 'size-10 rounded-xl [&>svg]:size-5', lg: 'size-12 rounded-2xl [&>svg]:size-6' }[size]
  return (
    <span className={cx('inline-flex shrink-0 items-center justify-center', dims, tones[tone])}>
      <Icon strokeWidth={2.2} />
    </span>
  )
}

export function Card({ title, icon, actions, children, className, padded = true }: { title?: ReactNode; icon?: LucideIcon; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cx('animate-rise rounded-card border border-slate-200/80 bg-white shadow-card dark:border-white/[0.06] dark:bg-ink-850', padded && 'p-5 sm:p-6', className)}>
      {(title || actions) && (
        <div className={cx('mb-5 flex flex-wrap items-center justify-between gap-3', !padded && 'px-5 pt-5 sm:px-6 sm:pt-6')}>
          {title && (
            <h2 className="flex items-center gap-3 text-[17px] font-bold text-slate-900 dark:text-white">
              {icon && <IconTile icon={icon} tone="slate" size="sm" />}
              {title}
            </h2>
          )}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-7 flex animate-rise flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1.5 text-xs font-bold tracking-[0.14em] text-brand-600 uppercase dark:text-brand-400">{eyebrow}</p>}
        <h1 className="text-[28px] leading-tight font-extrabold text-slate-900 sm:text-[32px] dark:text-white">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

type Tone = 'green' | 'red' | 'amber' | 'slate' | 'blue' | 'yellow'
const tones: Record<Tone, { pill: string; dot: string }> = {
  green: { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20', dot: 'bg-emerald-500' },
  red: { pill: 'bg-red-50 text-red-700 ring-red-600/15 dark:bg-red-400/10 dark:text-red-300 dark:ring-red-400/20', dot: 'bg-red-500' },
  amber: { pill: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20', dot: 'bg-amber-500' },
  yellow: { pill: 'bg-yellow-50 text-yellow-800 ring-yellow-600/20 dark:bg-yellow-400/10 dark:text-yellow-300 dark:ring-yellow-400/20', dot: 'bg-yellow-400' },
  slate: { pill: 'bg-slate-100 text-slate-700 ring-slate-500/15 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10', dot: 'bg-slate-400' },
  blue: { pill: 'bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/20', dot: 'bg-sky-500' },
}

export function Badge({ tone = 'slate', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ring-1 ring-inset', tones[tone].pill)}>
      <span className={cx('size-1.5 rounded-full', tones[tone].dot)} />
      {children}
    </span>
  )
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
    red: { box: 'border-red-200 bg-red-50/80 text-red-900 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-100', icon: XCircle, iconColor: 'text-red-500' },
    amber: { box: 'border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100', icon: AlertTriangle, iconColor: 'text-amber-500' },
    green: { box: 'border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100', icon: CheckCircle2, iconColor: 'text-emerald-500' },
    blue: { box: 'border-sky-200 bg-sky-50/80 text-sky-900 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-100', icon: Info, iconColor: 'text-sky-500' },
  }[tone]
  const Icon = styles.icon
  return (
    <div role={tone === 'red' ? 'alert' : 'status'} className={cx('flex animate-rise gap-3 rounded-2xl border p-4 text-[15px]', styles.box)}>
      <Icon className={cx('mt-0.5 size-5 shrink-0', styles.iconColor)} strokeWidth={2.2} />
      <div className="min-w-0">
        {title && <p className="font-bold">{title}</p>}
        <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>
      </div>
    </div>
  )
}

export function Loading({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-10 text-slate-500 dark:text-slate-400">
      <Spinner className="size-5 text-brand-500" /> {label}
    </div>
  )
}

export function Empty({ children, icon: Icon = Inbox }: { children: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center text-[15px] text-slate-500 dark:border-white/10 dark:bg-white/[0.02] dark:text-slate-400">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200 dark:bg-ink-800 dark:ring-white/10">
        <Icon className="size-6" />
      </span>
      {children}
    </div>
  )
}

/** Indicateur clé. `featured` : version sombre mise en avant (chiffre principal). */
export function StatCard({ label, value, hint, tone, icon, featured, className }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'green' | 'red' | 'amber'; icon?: LucideIcon; featured?: boolean; className?: string }) {
  if (featured) {
    return (
      <div className={cx('relative animate-rise overflow-hidden rounded-card bg-ink-gradient p-5 text-white shadow-pop ring-1 ring-white/10', className)}>
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative flex items-start justify-between gap-3">
          <p className="text-[13px] font-semibold text-slate-300">{label}</p>
          {icon && <IconTile icon={icon} tone="brand" size="sm" />}
        </div>
        <p className="tabular relative mt-3 text-[30px] leading-none font-extrabold tracking-tight">{value}</p>
        {hint && <p className="relative mt-2.5 text-[13px] text-slate-300">{hint}</p>}
      </div>
    )
  }
  const iconTone = tone === 'red' ? 'red' : tone === 'amber' ? 'amber' : tone === 'green' ? 'green' : 'slate'
  return (
    <div className={cx('animate-rise rounded-card border border-slate-200/80 bg-white p-5 shadow-card dark:border-white/[0.06] dark:bg-ink-850', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">{label}</p>
        {icon && <IconTile icon={icon} tone={iconTone} size="sm" />}
      </div>
      <p className={cx('tabular mt-3 text-[28px] leading-none font-extrabold tracking-tight', tone === 'red' ? 'text-red-600 dark:text-red-400' : tone === 'green' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white')}>
        {value}
      </p>
      {hint && <p className="mt-2.5 text-[13px] text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  )
}

/** Tableau responsive : défilement horizontal interne sur petit écran (jamais la page entière). */
export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto sm:-mx-6">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-y border-slate-100 bg-slate-50/70 text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:border-white/5 dark:bg-white/[0.02] dark:text-slate-400">
            {head.map((h, i) => (
              <th key={i} className="px-4 py-3 whitespace-nowrap first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5 [&>tr]:transition-colors [&>tr:hover]:bg-slate-50/80 dark:[&>tr:hover]:bg-white/[0.02]">{children}</tbody>
      </table>
    </div>
  )
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx('px-4 py-3.5 align-middle first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6', className)}>{children}</td>
}

export function Pagination({ page, lastPage, onChange }: { page: number; lastPage: number; onChange: (page: number) => void }) {
  if (lastPage <= 1) return null
  return (
    <div className="mt-5 flex items-center justify-between gap-2">
      <Button variant="secondary" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onChange(page - 1)}>Précédent</Button>
      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Page <span className="text-slate-900 dark:text-white">{page}</span> sur {lastPage}</span>
      <Button variant="secondary" size="sm" disabled={page >= lastPage} onClick={() => onChange(page + 1)}>Suivant <ChevronRight className="size-4" /></Button>
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[92vh] w-full animate-pop overflow-y-auto rounded-t-3xl border border-slate-200/80 bg-white p-6 shadow-pop sm:max-w-lg sm:rounded-3xl dark:border-white/10 dark:bg-ink-850"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="-m-1.5 rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-white" aria-label="Fermer">
            <X className="size-5" />
          </button>
        </div>
        {children}
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-5 dark:border-white/5">{footer}</div>}
      </div>
    </div>
  )
}

/** Photo de membre ou initiales sur dégradé. */
export function Avatar({ url, name, size = 'md' }: { url: string | null | undefined; name: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const dims = { sm: 'size-9 text-xs rounded-xl', md: 'size-12 text-sm rounded-2xl', lg: 'size-24 text-2xl rounded-3xl', xl: 'size-56 text-6xl rounded-[2rem]' }[size]
  const initials = name.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  return url ? (
    <img src={url} alt={name} className={cx(dims, 'shrink-0 object-cover shadow-sm ring-2 ring-white dark:ring-ink-800')} />
  ) : (
    <span className={cx(dims, 'inline-flex shrink-0 items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 font-bold text-slate-600 ring-2 ring-white dark:from-ink-700 dark:to-ink-600 dark:text-slate-200 dark:ring-ink-800')}>{initials}</span>
  )
}
