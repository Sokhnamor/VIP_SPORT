import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ReasonModal } from '../../components/ReasonModal'
import { ArrowLeft, BadgeCheck, CalendarRange, Receipt, ShieldCheck, Cake, Camera, Coins, DoorOpen, HeartPulse, Mail, Pencil, Phone, QrCode, ShieldOff, StickyNote, type LucideIcon } from 'lucide-react'
import { Alert, Avatar, Badge, Button, ButtonLink, Card, Empty, Field, Input, Loading, Modal, Table, Td, Textarea, cx, statusTone } from '../../components/ui'
import { api, errorMessage, openDocument } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { date, dateTime, fcfa, phone, scanLabel, todayIso } from '../../lib/format'
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

  // Affichage seulement : nombre de jours jusqu'à la fin de couverture renvoyée par le serveur.
  const joursRestants = m.couvert_jusqu_au ? Math.round((Date.parse(m.couvert_jusqu_au) - Date.parse(todayIso())) / 86_400_000) : null
  const covered = Boolean(current) && current?.statut !== 'suspendu'

  return (
    <div className="space-y-6">
      <Link to="/membres" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
        <ArrowLeft className="size-4" /> Membres
      </Link>

      {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}
      {m.statut === 'archive' && <Alert tone="amber">Membre archivé{m.anonymise ? ' et anonymisé' : ''} : aucun accès possible.</Alert>}

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        {/* Profil */}
        <section className="relative animate-rise overflow-hidden rounded-card border border-slate-200/80 bg-white shadow-card dark:border-white/[0.06] dark:bg-ink-850">
          <div className="h-24 bg-ink-gradient"><div className="bg-grid h-full opacity-60" /></div>
          <div className="px-6 pb-6">
            <div className="-mt-12 flex flex-wrap items-end justify-between gap-4">
              <Avatar url={m.photo_url} name={m.nom_complet} size="lg" />
              {m.statut === 'actif' && (
                <div className="flex flex-wrap gap-2">
                  <ButtonLink to={`/membres/${m.id}/modifier`} variant="secondary" icon={Pencil}>Modifier</ButtonLink>
                  <ButtonLink to={`/vente?membre=${m.id}`} icon={Coins}>{current ? 'Renouveler' : 'Vendre un abonnement'}</ButtonLink>
                </div>
              )}
            </div>
            <h1 className="mt-4 text-[28px] leading-tight font-extrabold text-slate-900 dark:text-white">{m.nom_complet}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Membre n° {String(m.id).padStart(5, '0')} · inscrit le {date(m.date_inscription)}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <InfoChip icon={Phone} label="Téléphone"><a href={`tel:${m.telephone}`} className="hover:underline">{phone(m.telephone)}</a></InfoChip>
              <InfoChip icon={Mail} label="E-mail">{m.email ?? '—'}</InfoChip>
              <InfoChip icon={Cake} label="Naissance">{date(m.date_naissance)}{m.sexe && <span className="font-normal text-slate-400"> · {m.sexe === 'F' ? 'Femme' : 'Homme'}</span>}</InfoChip>
              <InfoChip icon={HeartPulse} label="Contact d'urgence">{m.contact_urgence ?? '—'}</InfoChip>
            </div>
            {m.notes && (
              <p className="mt-3 flex gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
                <StickyNote className="mt-0.5 size-4 shrink-0 text-slate-400" />{m.notes}
              </p>
            )}
            {!m.photo_url && m.statut === 'actif' && (
              <p className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                <Camera className="size-4 shrink-0" /> Pas de photo : ajoutez-en une (Modifier) pour la vérification à l'entrée.
              </p>
            )}
          </div>
        </section>

        {/* Abonnement */}
        <section className={cx('relative flex animate-rise flex-col overflow-hidden rounded-card p-6 text-white shadow-pop', covered ? 'bg-ink-gradient' : 'bg-gradient-to-br from-red-600 to-rose-700')}>
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" />
          {covered && <div className="absolute -top-16 -right-16 size-56 rounded-full bg-brand-500/30 blur-[70px]" />}
          <div className="relative flex items-center justify-between">
            <p className="text-sm font-semibold text-white/70">Abonnement</p>
            <span className={cx('flex size-10 items-center justify-center rounded-xl', covered ? 'bg-brand-gradient shadow-glow' : 'bg-white/15')}>
              {covered ? <BadgeCheck className="size-5" /> : <ShieldOff className="size-5" />}
            </span>
          </div>
          {covered ? (
            <div className="relative mt-4">
              <p className="text-sm text-white/70">Couvert jusqu'au</p>
              <p className="tabular text-4xl font-extrabold tracking-tight">{date(m.couvert_jusqu_au)}</p>
              {joursRestants !== null && (
                <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold ring-1 ring-white/15">
                  <span className="size-2 rounded-full bg-brand-400" /> {joursRestants <= 0 ? 'Dernier jour' : `${joursRestants} jour(s) restant(s)`}
                </p>
              )}
            </div>
          ) : (
            <div className="relative mt-4">
              <p className="text-2xl font-extrabold">{current?.statut === 'suspendu' ? 'Abonnement suspendu' : 'Aucun abonnement valide'}</p>
              <p className="mt-1 text-white/80">L'entrée sera refusée au scan.</p>
            </div>
          )}
          <div className="relative mt-auto grid gap-2 pt-6">
            {m.a_un_qr ? (
              <button onClick={() => openDocument(`members/${m.id}/card`)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/10 font-semibold ring-1 ring-white/15 transition hover:bg-white/15">
                <QrCode className="size-4" /> Imprimer la carte (QR)
              </button>
            ) : (
              <p className="text-sm text-white/70">Le QR est créé au premier paiement d'abonnement.</p>
            )}
            {m.statut === 'actif' && (
              <button onClick={() => { setManualResult(null); setManualOpen(true) }} className="flex min-h-11 items-center justify-center gap-2 rounded-xl font-semibold text-white/80 transition hover:bg-white/10 hover:text-white">
                <DoorOpen className="size-4" /> Entrée manuelle…
              </button>
            )}
          </div>
        </section>
      </div>

      <Card title="Historique des abonnements" icon={CalendarRange}>
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

      <Card title="Paiements" icon={Receipt}>
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

      <Card title="Entrées récentes" icon={DoorOpen}>
        {entrees.length === 0 ? <Empty>Aucune entrée.</Empty> : (
          <Table head={['Date', 'Résultat', 'Type', 'Opérateur']}>
            {entrees.map((e) => (
              <tr key={e.id}>
                <Td className="whitespace-nowrap">{dateTime(e.scanned_at)}</Td>
                <Td>
                  <Badge tone={statusTone(e.resultat)}>{scanLabel(e.resultat)}</Badge>
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
        <Card title="Administration du membre" icon={ShieldCheck}>
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

function InfoChip({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-white/5 dark:bg-white/[0.02]">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm ring-1 ring-slate-200/70 dark:bg-ink-800 dark:text-slate-300 dark:ring-white/5"><Icon className="size-4" /></span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="truncate font-semibold text-slate-900 dark:text-white">{children}</p>
      </div>
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
