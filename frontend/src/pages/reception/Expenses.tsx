import { FileText, Plus } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ReasonModal } from '../../components/ReasonModal'
import { Alert, Badge, Button, Card, Empty, Field, Input, Loading, Modal, PageHeader, Pagination, Select, Table, Td, Textarea, statusTone } from '../../components/ui'
import { api, ApiError, openDocument, qs } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { CATEGORIES, date, fcfa, MODES, todayIso } from '../../lib/format'
import type { Expense, Paginated } from '../../lib/types'

export default function Expenses() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [statut, setStatut] = useState(isAdmin ? 'en_attente' : '')
  const [formOpen, setFormOpen] = useState(false)
  const [decision, setDecision] = useState<{ expense: Expense; kind: 'reject' | 'cancel' } | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const expenses = useQuery({
    queryKey: ['expenses', page, statut],
    queryFn: () => api<Paginated<Expense>>('expenses' + qs({ page, statut })),
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['expenses'] })

  const validate = async (e: Expense) => {
    try {
      await api(`expenses/${e.id}/validate`, { method: 'POST' })
      setFeedback('Dépense validée.')
      refresh()
    } catch (err) {
      setFeedback(err instanceof ApiError ? err.message : 'Erreur.')
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Gestion" title="Dépenses" subtitle="Saisie, justificatifs et validation par le patron." actions={<Button icon={Plus} onClick={() => setFormOpen(true)}>Nouvelle dépense</Button>} />
      {feedback && <div className="mb-4"><Alert tone="green">{feedback}</Alert></div>}

      <Card>
        <div className="mb-4 max-w-xs">
          <Field label="Statut">
            <Select value={statut} onChange={(e) => { setStatut(e.target.value); setPage(1) }}>
              <option value="">Tous</option>
              <option value="en_attente">En attente de validation</option>
              <option value="validee">Validées</option>
              <option value="rejetee">Rejetées</option>
              <option value="annulee">Annulées</option>
            </Select>
          </Field>
        </div>

        {expenses.isLoading && <Loading />}
        {expenses.data?.data.length === 0 && <Empty icon={FileText}>Aucune dépense.</Empty>}
        {expenses.data && expenses.data.data.length > 0 && (
          <Table head={['Date', 'Catégorie', 'Description', 'Montant', 'Mode', 'Auteur', 'Statut', '']}>
            {expenses.data.data.map((e) => (
              <tr key={e.id}>
                <Td className="whitespace-nowrap">{date(e.date_depense)}</Td>
                <Td>{e.categorie_libelle}</Td>
                <Td>
                  {e.description}
                  {e.payee_depuis_caisse && <span className="block text-xs text-slate-500">payée depuis la caisse #{e.cash_session_id}</span>}
                </Td>
                <Td className="whitespace-nowrap font-semibold">{fcfa(e.montant)}</Td>
                <Td>{e.mode_libelle}</Td>
                <Td>{e.auteur}</Td>
                <Td>
                  <Badge tone={statusTone(e.statut)}>{e.statut_libelle}</Badge>
                  {e.motif_decision && <span className="block text-xs text-slate-500">{e.motif_decision}</span>}
                </Td>
                <Td className="whitespace-nowrap">
                  {e.justificatif_url && <Button variant="ghost" onClick={() => openDocument(e.justificatif_url!)}>Justificatif</Button>}
                  {isAdmin && e.statut === 'en_attente' && (
                    <>
                      <Button variant="ghost" className="text-emerald-700" onClick={() => validate(e)}>Valider</Button>
                      <Button variant="ghost" className="text-red-700" onClick={() => setDecision({ expense: e, kind: 'reject' })}>Rejeter</Button>
                    </>
                  )}
                  {isAdmin && e.statut === 'validee' && (
                    <Button variant="ghost" className="text-red-700" onClick={() => setDecision({ expense: e, kind: 'cancel' })}>Annuler</Button>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        )}
        {expenses.data?.meta && <Pagination page={page} lastPage={expenses.data.meta.last_page} onChange={setPage} />}
      </Card>

      <ExpenseForm open={formOpen} isAdmin={isAdmin} onClose={() => setFormOpen(false)} onSaved={(msg) => { setFeedback(msg); refresh(); queryClient.invalidateQueries({ queryKey: ['cash'] }) }} />

      <ReasonModal
        open={decision !== null}
        title={decision?.kind === 'reject' ? 'Rejeter la dépense' : 'Annuler la dépense'}
        confirmLabel={decision?.kind === 'reject' ? 'Rejeter' : 'Annuler la dépense'}
        danger
        onClose={() => setDecision(null)}
        onConfirm={async (motif) => {
          await api(`expenses/${decision!.expense.id}/${decision!.kind}`, { body: { motif } })
          setFeedback(decision!.kind === 'reject' ? 'Dépense rejetée.' : 'Dépense annulée.')
          refresh()
        }}
      />
    </div>
  )
}

function ExpenseForm({ open, isAdmin, onClose, onSaved }: { open: boolean; isAdmin: boolean; onClose: () => void; onSaved: (msg: string) => void }) {
  const [values, setValues] = useState({ date_depense: todayIso(), categorie: 'entretien', montant: '', description: '', mode: 'especes', payee_depuis_caisse: false })
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(false)
  const set = (key: string, value: unknown) => setValues((v) => ({ ...v, [key]: value }))

  const submit = async () => {
    setLoading(true)
    setError(null)
    const form = new FormData()
    Object.entries(values).forEach(([k, v]) => form.append(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v)))
    if (file) form.append('justificatif', file)
    try {
      await api('expenses', { method: 'POST', form })
      onSaved(isAdmin ? 'Dépense enregistrée et validée.' : 'Dépense enregistrée : en attente de validation par le patron.')
      setValues({ ...values, montant: '', description: '' })
      setFile(null)
      onClose()
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'Erreur inattendue.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} title="Nouvelle dépense" onClose={onClose} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Annuler</Button>
        <Button onClick={submit} loading={loading}>Enregistrer</Button>
      </>
    }>
      <div className="space-y-3">
        {error && !error.errors && <Alert>{error.message}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date" error={error?.field('date_depense')}><Input type="date" value={values.date_depense} onChange={(e) => set('date_depense', e.target.value)} /></Field>
          <Field label="Catégorie">
            <Select value={values.categorie} onChange={(e) => set('categorie', e.target.value)}>
              {Object.entries(CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Montant (FCFA)" required error={error?.field('montant')}><Input type="number" inputMode="numeric" min={1} value={values.montant} onChange={(e) => set('montant', e.target.value)} /></Field>
          <Field label="Mode de paiement">
            <Select value={values.mode} onChange={(e) => set('mode', e.target.value)}>
              {Object.entries(MODES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Description" required error={error?.field('description')}><Textarea value={values.description} onChange={(e) => set('description', e.target.value)} /></Field>
        {values.mode === 'especes' && (
          <label className="flex min-h-11 items-center gap-3 font-medium">
            <input type="checkbox" className="size-5" checked={values.payee_depuis_caisse} onChange={(e) => set('payee_depuis_caisse', e.target.checked)} />
            Payée avec les espèces de ma caisse (déduite à la clôture)
          </label>
        )}
        <Field label="Justificatif (photo ou PDF, optionnel)" error={error?.field('justificatif')}>
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-slate-200 file:px-4 file:font-semibold dark:file:bg-slate-700" />
        </Field>
      </div>
    </Modal>
  )
}
