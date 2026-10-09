import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Search, UserX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, qs } from '../lib/api'
import { date } from '../lib/format'
import type { Member, Paginated } from '../lib/types'
import { Avatar, Badge, Input, Spinner } from './ui'

/** Recherche rapide par nom ou téléphone (tolérance aux accents et fautes faite par le serveur). */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function MemberSearch({ onSelect, autoFocus, placeholder }: { onSelect: (member: Member) => void; autoFocus?: boolean; placeholder?: string }) {
  const [q, setQ] = useState('')
  const term = useDebounced(q.trim())

  const results = useQuery({
    queryKey: ['members', 'search', term],
    queryFn: () => api<Paginated<Member>>('members' + qs({ q: term, par_page: 8 })),
    enabled: term.length >= 2,
  })

  const open = term.length >= 2 && q.trim().length >= 2 && results.data

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-400" />
      <Input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder ?? 'Nom, prénom ou téléphone…'}
        autoFocus={autoFocus}
        className="min-h-14 rounded-2xl pr-12 pl-12 text-base"
        aria-label="Rechercher un membre"
      />
      {results.isFetching && <Spinner className="absolute top-1/2 right-4 size-5 -translate-y-1/2 text-brand-500" />}

      {open && (
        <ul className="absolute inset-x-0 top-full z-40 mt-2 max-h-[420px] animate-pop overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-1.5 text-slate-900 shadow-pop dark:border-white/10 dark:bg-ink-850 dark:text-slate-100">
          {results.data.data.length === 0 && (
            <li className="flex items-center gap-3 p-4 text-slate-500 dark:text-slate-400"><UserX className="size-5" /> Aucun membre trouvé.</li>
          )}
          {results.data.data.map((m) => {
            const statut = m.abonnement_en_cours?.statut
            return (
              <li key={m.id}>
                <button type="button" onClick={() => { onSelect(m); setQ('') }} className="group flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-white/5">
                  <Avatar url={m.photo_url} name={m.nom_complet} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{m.nom_complet}</span>
                    <span className="block text-sm text-slate-500 dark:text-slate-400">{m.telephone_affiche}</span>
                  </span>
                  {statut === 'actif' || statut === 'a_venir' ? (
                    <Badge tone="green">jusqu'au {date(m.couvert_jusqu_au)}</Badge>
                  ) : statut === 'suspendu' ? (
                    <Badge tone="amber">Suspendu</Badge>
                  ) : (
                    <Badge tone="red">Sans abonnement</Badge>
                  )}
                  <ChevronRight className="size-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
