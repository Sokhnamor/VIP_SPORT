import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api, qs } from '../lib/api'
import { date } from '../lib/format'
import type { Member, Paginated } from '../lib/types'
import { Avatar, Badge, Input, Spinner, statusTone } from './ui'

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

  return (
    <div>
      <div className="relative">
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder ?? 'Nom, prénom ou téléphone…'}
          autoFocus={autoFocus}
          className="min-h-14 text-lg"
          aria-label="Rechercher un membre"
        />
        {results.isFetching && <Spinner className="absolute top-4 right-4 size-5 text-slate-400" />}
      </div>

      {term.length >= 2 && results.data && (
        <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 dark:divide-slate-800 dark:bg-slate-900 dark:ring-slate-700">
          {results.data.data.length === 0 && <li className="p-4 text-slate-500">Aucun membre trouvé.</li>}
          {results.data.data.map((m) => {
            const statut = m.abonnement_en_cours?.statut ?? 'expire'
            return (
              <li key={m.id}>
                <button type="button" onClick={() => { onSelect(m); setQ('') }} className="flex w-full items-center gap-3 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800">
                  <Avatar url={m.photo_url} name={m.nom_complet} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{m.nom_complet}</span>
                    <span className="block text-sm text-slate-500">{m.telephone_affiche}</span>
                  </span>
                  <Badge tone={statusTone(statut)}>
                    {m.couvert_jusqu_au ? `jusqu'au ${date(m.couvert_jusqu_au)}` : 'Sans abonnement'}
                  </Badge>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
