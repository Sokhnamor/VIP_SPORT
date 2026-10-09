import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ReasonModal } from '../../components/ReasonModal'
import { Alert, Avatar, Badge, Button, ButtonLink, Card, Empty, Field, Input, Loading, Modal, PageHeader, Table, Td, Textarea, statusTone } from '../../components/ui'
import { api, errorMessage, openDocument } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { date, dateTime, fcfa, phone } from '../../lib/format'
import type { AccessLog, Member, Payment, ScanResult, Subscription } from '../../lib/types'

type Detail = { data: Member; abonnements: Subscription[]; paiements: Payment[]; entrees: AccessLog[] }

export default function MemberDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()
  const [manualOpen, setManualOpen] = useState(false)
  const [manualResult, setManualResult] = useState<ScanResult | null>(null)
  const [suspendTarget, setSuspendTarget] = useState<Subscription | null>(null)
  const [resumeTarget, setResumeTarget] = useState<Subscription | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Payment | null>(null)
  const [confirm, setConfirm] = useState<null | 'archive' | 'unarchive' | 'anonymize' | 'regenerate'>(null)
  const [feedback, setFeedback] = useState<{ tone: 'green' | 'red'; text: string } | null>(null)

  const detail = useQuery({ queryKey: ['member', id, 'detail'], queryFn: () => api<Detail>(`members/${id}`) })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['member', id] })
    queryClient.invalidateQueries({ queryKey: ['members'] })
  }

  const action = useMutation({
    mutationFn: (kind: 'archive' | 'unarchive' | 'anonymize' | 'regenerate') =>
      api(`members/${id}/${kind === 'regenerate' ? 'regenerate-qr' : kind}`, { method: 'POST' }),
    onSuccess: (_, kind) => {
      setConfirm(null)
      setFeedback({
        tone: 'green',
        text: {
          archive: 'Membre archivé : son QR est désormais refusé.',
          unarchive: 'Membre réactivé.',
          anonymize: 'Données personnelles anonymisées.',
          regenerate: 'Nouveau QR généré : l\'ancienne carte est refusée. Imprimez la nouvelle carte.',
        }[kind],
      })
      refresh()
    },
    onError: (e) => { setConfirm(null); setFeedback({ tone: 'red', text: errorMessage(e) }) },
  })

  if (detail.isLoading) return <Loading />
  if (detail.error || !detail.data) return <Alert>{errorMessage(detail.error)}</Alert>

  const { data: m, abonnements, paiements, entrees } = detail.data
  const current = m.abonnement_en_cours

  return (
    <div className="space-y-5">
      <PageHeader
        title={m.nom_complet}
        subtitle={<>Membre n° {m.id} · inscrit le {date(m.date_inscription)}</>}
        actions={
          m.statut === 'actif' && (
            <>
              <ButtonLink to={`/vente?membre=${m.id}`}>{current ? 'Renouveler' : 'Vendre un abonnement'}</ButtonLink>
              <ButtonLink to={`/membres/${m.id}/modifier`} variant="secondary">Modifier</ButtonLink>
            </>
          )
        }
      />

      {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}
      {m.statut === 'archive' && <Alert tone="amber">Membre archivé{m.anonymise ? ' et anonymisé' : ''} : aucun accès possible.</Alert>}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-col gap-5 sm:flex-row">
            <Avatar url={m.photo_url} name={m.nom_complet} size="lg" />
            <dl className="grid flex-1 grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              <Info label="Téléphone">
                <a href={`tel:${m.telephone}`} className="font-semibold hover:underline">{phone(m.telephone)}</a>
              </Info>
              <Info label="E-mail">{m.email ?? '—'}</Info>
              <Info label="Date de naissance">{date(m.date_naissance)}</Info>
              <Info label="Sexe">{m.sexe === 'F' ? 'Femme' : m.sexe === 'M' ? 'Homme' : '—'}</Info>
              <Info label="Contact d'urgence">{m.contact_urgence ?? '—'}</Info>
              <Info label="Notes">{m.notes ?? '—'}</Info>
            </dl>
          </div>
          {!m.photo_url && m.statut === 'actif' && (
            <p className="mt-4 text-sm font-medium text-amber-700 dark:text-amber-400">
              Pas de photo : ajoutez-en une (bouton Modifier) pour permettre la vérification à l'entrée.
            </p>
          )}
        </Card>

        <Card title="Abonnement">
          {current ? (
            <div className="space-y-2">
              <Badge tone={statusTone(current.statut)}>{current.statut_libelle}</Badge>
              <p className="text-lg">
                Couvert jusqu'au <strong>{date(m.couvert_jusqu_au)}</strong>
              </p>
            </div>
          ) : (
            <Alert tone="red">Aucun abonnement valide aujourd'hui : l'entrée sera refusée.</Alert>
          )}
          <div className="mt-4 flex flex-col gap-2">
            {m.a_un_qr ? (
              <Button variant="secondary" onClick={() => openDocument(`members/${m.id}/card`)}>Imprimer la carte (QR)</Button>
            ) : (
              <p className="text-sm text-slate-500">Le QR est créé au premier paiement d'abonnement.</p>
            )}
            {m.statut === 'actif' && (
              <Button variant="secondary" onClick={() => { setManualResult(null); setManualOpen(true) }}>Entrée manuelle…</Button>
            )}
          </div>
        </Card>
      </div>

      <Card title="Historique des abonnements">
        {abonnements.length === 0 ? <Empty>Aucun abonnement.</Empty> : (
          <Table head={['Formule', 'Période', 'Statut', isAdmin ? 'Actions' : '']}>
            {abonnements.map((s) => (
              <tr key={s.id}>
                <Td>{s.plan?.nom}</Td>
                <Td className="whitespace-nowrap">
                  {date(s.date_debut)} → {date(s.date_fin)}
                  {s.date_fin !== s.date_fin_initiale && <span className="block text-xs text-slate-500">fin initiale {date(s.date_fin_initiale)}</span>}
                </Td>
                <Td>
                  <Badge tone={statusTone(s.statut)}>{s.statut_libelle}</Badge>
                  {s.suspendu_motif && s.statut === 'suspendu' && <span className="block text-xs text-slate-500">{s.suspendu_motif}</span>}
                </Td>
                <Td>
                  {isAdmin && (s.statut === 'actif' || s.statut === 'a_venir') && (
                    <Button variant="ghost" onClick={() => setSuspendTarget(s)}>Suspendre</Button>
                  )}
                  {isAdmin && s.statut === 'suspendu' && <Button variant="ghost" onClick={() => setResumeTarget(s)}>Réactiver…</Button>}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="Paiements">
        {paiements.length === 0 ? <Empty>Aucun paiement.</Empty> : (
          <Table head={['Reçu', 'Date', 'Formule', 'Montant', 'Mode', 'Encaisseur', '']}>
            {paiements.map((p) => (
              <tr key={p.id} className={p.annule ? 'opacity-60' : ''}>
                <Td><Link to={`/recus/${p.id}`} className="font-semibold hover:underline">{p.numero_recu}</Link></Td>
                <Td className="whitespace-nowrap">{dateTime(p.created_at)}</Td>
                <Td>{p.plan?.nom}</Td>
                <Td className="whitespace-nowrap">
                  {fcfa(p.montant_encaisse)}
                  {p.reduction > 0 && <span className="block text-xs text-slate-500">réduction {fcfa(p.reduction)}</span>}
                </Td>
                <Td>{p.mode_libelle}</Td>
                <Td>{p.encaisseur?.nom}</Td>
                <Td className="whitespace-nowrap">
                  {p.annule ? <Badge tone="red">Annulé</Badge> : (
                    <>
                      <Button variant="ghost" onClick={() => openDocument(`payments/${p.id}/receipt`)}>Reçu</Button>
                      {isAdmin && <Button variant="ghost" className="text-red-700 dark:text-red-400" onClick={() => setCancelTarget(p)}>Annuler</Button>}
                    </>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="Entrées récentes">
        {entrees.length === 0 ? <Empty>Aucune entrée.</Empty> : (
          <Table head={['Date', 'Résultat', 'Type', 'Opérateur']}>
            {entrees.map((e) => (
              <tr key={e.id}>
                <Td className="whitespace-nowrap">{dateTime(e.scanned_at)}</Td>
                <Td>
                  <Badge tone={statusTone(e.resultat)}>{e.resultat}</Badge>
                  {e.manuel && <span className="ml-2 text-xs font-semibold text-amber-700">manuelle : {e.motif_manuel}</span>}
                </Td>
                <Td>{e.type === 'sortie' ? 'Sortie' : 'Entrée'}</Td>
                <Td>{e.operateur}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {isAdmin && (
        <Card title="Administration du membre">
          <div className="flex flex-wrap gap-2">
            {m.a_un_qr && m.statut === 'actif' && <Button variant="secondary" onClick={() => setConfirm('regenerate')}>Carte perdue : régénérer le QR</Button>}
            {m.statut === 'actif' ? (
              <Button variant="secondary" onClick={() => setConfirm('archive')}>Archiver</Button>
            ) : (
              !m.anonymise && <Button variant="secondary" onClick={() => setConfirm('unarchive')}>Réactiver</Button>
            )}
            <Button variant="secondary" onClick={() => openDocument(`members/${m.id}/export`)}>Exporter ses données</Button>
            {!m.anonymise && <Button variant="danger" onClick={() => setConfirm('anonymize')}>Anonymiser…</Button>}
          </div>
        </Card>
      )}

      <Modal
        open={confirm !== null}
        title="Confirmer"
        onClose={() => setConfirm(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>Annuler</Button>
            <Button variant={confirm === 'anonymize' ? 'danger' : 'primary'} loading={action.isPending} onClick={() => confirm && action.mutate(confirm)}>Confirmer</Button>
          </>
        }
      >
        <p>
          {confirm === 'archive' && 'Archiver ce membre ? Son QR sera refusé à l\'entrée. L\'historique est conservé.'}
          {confirm === 'unarchive' && 'Réactiver ce membre ?'}
          {confirm === 'regenerate' && 'Générer un nouveau QR ? L\'ancienne carte sera immédiatement refusée.'}
          {confirm === 'anonymize' && 'Effacer définitivement l\'identité, la photo et les coordonnées de ce membre ? L\'historique financier est conservé. Action irréversible.'}
        </p>
      </Modal>

      <ManualEntryModal open={manualOpen} member={m} result={manualResult} onResult={setManualResult} onClose={() => { setManualOpen(false); refresh() }} />

      <ReasonModal
        open={suspendTarget !== null}
        title="Suspendre l'abonnement"
        description="Le scan sera refusé pendant la suspension (blessure, voyage, impayé…)."
        confirmLabel="Suspendre"
        onClose={() => setSuspendTarget(null)}
        onConfirm={async (motif) => {
          await api(`subscriptions/${suspendTarget!.id}/suspend`, { body: { motif } })
          setFeedback({ tone: 'green', text: 'Abonnement suspendu.' })
          refresh()
        }}
      />

      <ResumeModal target={resumeTarget} onClose={() => setResumeTarget(null)} onDone={() => { setFeedback({ tone: 'green', text: 'Abonnement réactivé.' }); refresh() }} />

      <ReasonModal
        open={cancelTarget !== null}
        title={`Annuler le paiement ${cancelTarget?.numero_recu ?? ''}`}
        description={`Le paiement de ${fcfa(cancelTarget?.montant_encaisse)} reste enregistré ; une annulation tracée y est liée. L'abonnement sera annulé et le QR refusé immédiatement.`}
        confirmLabel="Annuler le paiement"
        danger
        onClose={() => setCancelTarget(null)}
        onConfirm={async (motif) => {
          await api(`payments/${cancelTarget!.id}/cancel`, { body: { motif } })
          setFeedback({ tone: 'green', text: 'Paiement annulé.' })
          refresh()
        }}
      />
    </div>
  )
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="font-medium break-words">{children}</dd>
    </div>
  )
}

function ManualEntryModal({ open, member, result, onResult, onClose }: { open: boolean; member: Member; result: ScanResult | null; onResult: (r: ScanResult) => void; onClose: () => void }) {
  const [motif, setMotif] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setError(null)
    setLoading(true)
    try {
      const r = await api<{ data: ScanResult }>('access/manual', { body: { member_id: member.id, motif } })
      onResult(r.data)
      setMotif('')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} title="Entrée manuelle exceptionnelle" onClose={onClose} footer={!result && (
      <>
        <Button variant="secondary" onClick={onClose}>Annuler</Button>
        <Button onClick={submit} loading={loading} disabled={motif.trim().length < 3}>Enregistrer l'entrée</Button>
      </>
    )}>
      {result ? (
        <div className="space-y-4">
          <Alert tone={result.accepte ? 'green' : 'red'} title={result.accepte ? 'Entrée acceptée' : 'Entrée refusée'}>{result.message}</Alert>
          <Button className="w-full" onClick={onClose}>Fermer</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p>
            À utiliser uniquement si le QR de <strong>{member.nom_complet}</strong> est illisible. L'entrée est vérifiée par le serveur, marquée « manuelle » et visible par le patron.
          </p>
          {error && <Alert>{error}</Alert>}
          <Field label="Motif" required>
            <Textarea value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex. téléphone déchargé, carte abîmée…" autoFocus />
          </Field>
        </div>
      )}
    </Modal>
  )
}

function ResumeModal({ target, onClose, onDone }: { target: Subscription | null; onClose: () => void; onDone: () => void }) {
  const [dateFin, setDateFin] = useState('')
  const [motif, setMotif] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    setError(null)
    try {
      await api(`subscriptions/${target!.id}/resume`, { body: { date_fin: dateFin || null, motif: motif || null } })
      onDone()
      onClose()
      setDateFin('')
      setMotif('')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={target !== null} title="Réactiver l'abonnement" onClose={onClose} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Annuler</Button>
        <Button onClick={submit} loading={loading} disabled={dateFin !== '' && motif.trim().length < 3}>Réactiver</Button>
      </>
    }>
      <div className="space-y-3">
        {error && <Alert>{error}</Alert>}
        <p>Fin actuelle : <strong>{date(target?.date_fin)}</strong>. Pour compenser la suspension, saisissez une nouvelle date de fin (tracée dans l'audit).</p>
        <Field label="Nouvelle date de fin (optionnel)">
          <Input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
        </Field>
        {dateFin && (
          <Field label="Motif de la prolongation" required>
            <Textarea value={motif} onChange={(e) => setMotif(e.target.value)} />
          </Field>
        )}
      </div>
    </Modal>
  )
}
