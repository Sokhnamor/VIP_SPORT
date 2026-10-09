import { Banknote, History, Lock, ListChecks, Smartphone, Wallet } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../lib/auth'
import { useState } from 'react'
import { Link } from 'react-router'
import { Alert, Badge, Button, Card, Empty, Field, Input, Loading, PageHeader, Pagination, Table, Td, Textarea, cx } from '../../components/ui'
import { api, ApiError, openDocument } from '../../lib/api'
import { dateTime, fcfa, fcfaSigned, time } from '../../lib/format'
import type { CashSession, Paginated } from '../../lib/types'

/** Caisse du réceptionniste : ouverture, état en cours, clôture, historique. */
export default function Cash() {
  const queryClient = useQueryClient()
  const current = useQuery({
    queryKey: ['cash', 'current'],
    queryFn: () => api<{ data: CashSession | null }>('cash-sessions/current').then((r) => r.data),
    refetchInterval: 30_000,
  })
  const { user } = useAuth()
  const [page, setPage] = useState(1)
  // « Mes sessions » : filtré sur l'utilisateur connecté (l'admin voit tout dans « Caisses »).
  const history = useQuery({ queryKey: ['cash', 'history', page, user?.id], queryFn: () => api<Paginated<CashSession>>(`cash-sessions?page=${page}&user_id=${user?.id ?? ''}`) })
  const [closed, setClosed] = useState<CashSession | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['cash'] })

  if (current.isLoading) return <Loading />

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Réception" title="Ma caisse" subtitle="Fond de caisse, encaissements du jour et clôture." />

      {closed && (
        <Alert tone={closed.ecart === 0 ? 'green' : 'amber'} title="Session clôturée et verrouillée">
          Attendu {fcfa(closed.especes_attendues)}, compté {fcfa(closed.especes_comptees)} — écart {fcfaSigned(closed.ecart)}.
        </Alert>
      )}

      {current.data ? <OpenSession session={current.data} onClosed={(s) => { setClosed(s); refresh() }} /> : <OpenForm onOpened={() => { setClosed(null); refresh() }} />}

      <Card title="Historique de mes sessions" icon={History}>
        {history.data?.data.length === 0 && <Empty>Aucune session.</Empty>}
        {history.data && history.data.data.length > 0 && (
          <SessionsTable sessions={history.data.data} />
        )}
        {history.data?.meta && <Pagination page={page} lastPage={history.data.meta.last_page} onChange={setPage} />}
      </Card>
    </div>
  )
}

export function SessionsTable({ sessions, showEmployee }: { sessions: CashSession[]; showEmployee?: boolean }) {
  return (
    <Table head={['N°', ...(showEmployee ? ['Employé'] : []), 'Ouverture', 'Clôture', 'Attendu', 'Compté', 'Écart', '']}>
      {sessions.map((s) => (
        <tr key={s.id}>
          <Td><Link to={`/caisse/${s.id}`} className="font-semibold hover:underline">#{s.id}</Link></Td>
          {showEmployee && <Td>{s.employe?.nom}</Td>}
          <Td className="whitespace-nowrap">{dateTime(s.ouverte_at)}</Td>
          <Td className="whitespace-nowrap">{s.fermee_at ? dateTime(s.fermee_at) : <Badge tone={s.oubli_cloture ? 'red' : 'blue'}>{s.oubli_cloture ? 'Non clôturée !' : 'Ouverte'}</Badge>}</Td>
          <Td className="whitespace-nowrap">{fcfa(s.especes_attendues)}</Td>
          <Td className="whitespace-nowrap">{fcfa(s.especes_comptees)}</Td>
          <Td className={cx('whitespace-nowrap font-bold', s.ecart !== null && s.ecart < 0 && 'text-red-600', s.ecart !== null && s.ecart > 0 && 'text-amber-600')}>
            {s.ecart === null ? '—' : fcfaSigned(s.ecart)}
            {s.motif_ecart && <span className="block text-xs font-normal text-slate-500">{s.motif_ecart}</span>}
          </Td>
          <Td>{s.commentaire_admin && <Badge tone="blue">Commentée</Badge>}</Td>
        </tr>
      ))}
    </Table>
  )
}

function OpenForm({ onOpened }: { onOpened: () => void }) {
  const [fond, setFond] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const open = async () => {
    setLoading(true)
    setError(null)
    try {
      await api('cash-sessions', { body: { fond_initial: parseInt(fond || '0', 10) } })
      onOpened()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur inattendue.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <div className="grid items-center gap-6 md:grid-cols-[1fr_380px]">
        <div>
          <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow"><Wallet className="size-7" /></span>
          <h2 className="mt-4 text-2xl font-extrabold text-slate-900 dark:text-white">Ouvrir ma session de caisse</h2>
          <p className="mt-2 max-w-md text-slate-500 dark:text-slate-400">Comptez les espèces présentes dans le tiroir avant la première vente. Tous vos encaissements seront rattachés à cette session.</p>
        </div>
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Fond de caisse initial (FCFA)">
          <Input type="number" inputMode="numeric" min={0} value={fond} onChange={(e) => setFond(e.target.value)} autoFocus />
        </Field>
        <Button size="lg" className="w-full" icon={Wallet} loading={loading} onClick={open}>Ouvrir la caisse</Button>
      </div>
      </div>
    </Card>
  )
}

function OpenSession({ session, onClosed }: { session: CashSession; onClosed: (s: CashSession) => void }) {
  const [comptees, setComptees] = useState('')
  const [motif, setMotif] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(false)
  const t = session.totaux!
  // Aperçu seulement : l'écart officiel est calculé et enregistré par le serveur.
  const apercuEcart = comptees === '' ? null : parseInt(comptees, 10) - t.especes_attendues

  const close = async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api<{ data: CashSession }>(`cash-sessions/${session.id}/close`, { body: { especes_comptees: parseInt(comptees, 10), motif_ecart: motif || null } })
      onClosed(r.data)
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'Erreur inattendue.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title={`Session #${session.id} ouverte à ${time(session.ouverte_at)}`} icon={ListChecks} actions={<Button variant="secondary" size="sm" icon={Smartphone} onClick={() => openDocument(`cash-sessions/${session.id}/mobile-money?format=pdf`)}>Liste Wave / OM</Button>}>
        {session.oubli_cloture && <div className="mb-3"><Alert>Cette session date d'un jour précédent : clôturez-la maintenant.</Alert></div>}
        <dl className="space-y-2 text-lg">
          <Line label="Fond initial" value={fcfa(t.fond_initial)} />
          <Line label="+ Encaissements espèces" value={fcfa(t.especes)} />
          <Line label="− Dépenses payées en caisse" value={fcfa(t.depenses_especes)} />
          <div className="-mx-1 flex items-center justify-between rounded-2xl bg-ink-gradient px-4 py-3.5 text-white shadow-pop">
            <dt className="flex items-center gap-2 font-semibold"><Banknote className="size-5 text-brand-400" /> Espèces attendues</dt>
            <dd className="tabular text-2xl font-extrabold">{fcfa(t.especes_attendues)}</dd>
          </div>
          <Line label="Wave (à part)" value={fcfa(t.wave)} />
          <Line label="Orange Money (à part)" value={fcfa(t.orange_money)} />
          {t.autre > 0 && <Line label="Autre" value={fcfa(t.autre)} />}
          <Line label="Nombre d'encaissements" value={String(t.nombre_paiements)} />
        </dl>
        <Link to={`/caisse/${session.id}`} className="mt-3 inline-block font-semibold text-brand-700 hover:underline dark:text-brand-500">Voir le détail des paiements →</Link>
      </Card>

      <Card title="Clôturer la caisse" icon={Lock}>
        <div className="space-y-4">
          <p className="text-slate-600 dark:text-slate-400">Comptez toutes les espèces présentes dans la caisse et saisissez le total. La session sera verrouillée.</p>
          {error && !error.errors && <Alert>{error.message}</Alert>}
          <Field label="Espèces comptées (FCFA)" required>
            <Input type="number" inputMode="numeric" min={0} value={comptees} onChange={(e) => setComptees(e.target.value)} />
          </Field>
          {apercuEcart !== null && !Number.isNaN(apercuEcart) && (
            <p className={cx('tabular rounded-xl px-4 py-3 text-lg font-bold', apercuEcart === 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300')}>
              Écart : {fcfaSigned(apercuEcart)}
            </p>
          )}
          {apercuEcart !== null && apercuEcart !== 0 && (
            <Field label="Motif de l'écart" required error={error?.field('motif_ecart')}>
              <Textarea value={motif} onChange={(e) => setMotif(e.target.value)} />
            </Field>
          )}
          <Button size="lg" className="w-full" variant="dark" icon={Lock} loading={loading} disabled={comptees === ''} onClick={close}>Clôturer et verrouiller</Button>
        </div>
      </Card>
    </div>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-600 dark:text-slate-400">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  )
}
