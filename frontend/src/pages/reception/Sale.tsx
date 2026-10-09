import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { MemberSearch } from '../../components/MemberSearch'
import { Banknote, CalendarRange, CheckCircle2, CreditCard, Percent, Printer, Receipt, Smartphone, Ticket, UserPlus, Wallet, type LucideIcon } from 'lucide-react'
import { Alert, Avatar, Button, ButtonLink, Card, Field, Input, Loading, Modal, PageHeader, cx } from '../../components/ui'
import { api, ApiError, openDocument } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { date, fcfa, MODES } from '../../lib/format'
import type { CashSession, Member, Payment, Plan } from '../../lib/types'

type Quote = { montant_du: number; date_debut: string; date_fin: string; renouvellement_anticipe: boolean }

/**
 * Vente d'un abonnement (ou renouvellement) ou d'une séance unique.
 * Le montant dû et la période sont calculés par le serveur ; l'écran ne fait qu'afficher et envoyer.
 */
export default function Sale() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isTicket = params.get('type') === 'seance'
  const memberId = params.get('membre')

  const [planId, setPlanId] = useState<number | null>(null)
  const [mode, setMode] = useState<string>('especes')
  const [reference, setReference] = useState('')
  const [showReduction, setShowReduction] = useState(false)
  const [reduction, setReduction] = useState('')
  const [motifReduction, setMotifReduction] = useState('')
  const [adminId, setAdminId] = useState('')
  const [adminPwd, setAdminPwd] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [done, setDone] = useState<Payment | null>(null)

  const cash = useQuery({ queryKey: ['cash', 'current'], queryFn: () => api<{ data: CashSession | null }>('cash-sessions/current').then((r) => r.data) })
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => api<{ data: Plan[] }>('plans').then((r) => r.data) })
  const member = useQuery({
    queryKey: ['member', memberId],
    queryFn: () => api<{ data: Member }>(`members/${memberId}`).then((r) => r.data),
    enabled: Boolean(memberId),
  })

  const availablePlans = (plans.data ?? []).filter((p) => p.est_seance === isTicket)
  const plan = availablePlans.find((p) => p.id === planId) ?? (isTicket ? availablePlans[0] : undefined)

  const quote = useQuery({
    queryKey: ['quote', memberId, plan?.id],
    queryFn: () => api<{ data: Quote }>(`members/${memberId}/quote?plan_id=${plan!.id}`).then((r) => r.data),
    enabled: !isTicket && Boolean(memberId) && Boolean(plan),
  })

  const reductionValue = showReduction ? Math.max(0, parseInt(reduction || '0', 10) || 0) : 0
  const montantDu = plan?.prix_fcfa ?? 0
  const aEncaisser = Math.max(0, montantDu - reductionValue)
  const needsReference = mode === 'wave' || mode === 'orange_money'

  const setType = (type: 'abonnement' | 'seance') => {
    const next = new URLSearchParams(params)
    if (type === 'seance') next.set('type', 'seance')
    else next.delete('type')
    setParams(next)
    setPlanId(null)
  }

  const selectMember = (m: Member | null) => {
    const next = new URLSearchParams(params)
    if (m) next.set('membre', String(m.id))
    else next.delete('membre')
    setParams(next)
  }

  const submit = async () => {
    if (!plan) return
    setSubmitting(true)
    setError(null)
    const body: Record<string, unknown> = {
      plan_id: plan.id,
      member_id: memberId ? Number(memberId) : null,
      mode,
      montant_encaisse: aEncaisser,
      reference_transaction: needsReference || mode === 'autre' ? reference.trim() || null : null,
    }
    if (reductionValue > 0) {
      body.reduction = reductionValue
      body.motif_reduction = motifReduction.trim()
      if (user?.role !== 'admin') body.autorisation = { identifiant: adminId.trim(), mot_de_passe: adminPwd }
    }
    try {
      const r = await api<{ data: Payment }>(isTicket ? 'sales/ticket' : 'sales/subscription', { body })
      setDone(r.data)
      setConfirmOpen(false)
      setAdminPwd('')
      queryClient.invalidateQueries({ queryKey: ['cash'] })
      queryClient.invalidateQueries({ queryKey: ['member'] })
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    } catch (e) {
      setConfirmOpen(false)
      setError(e instanceof ApiError ? e : new ApiError(0, 'Erreur inattendue.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (done) return <SaleDone payment={done} onNew={() => { setDone(null); setReference(''); setReduction(''); setMotifReduction(''); setShowReduction(false); navigate(isTicket ? '/vente?type=seance' : '/vente') }} />
  if (plans.isLoading || cash.isLoading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Encaissement" title={isTicket ? 'Vendre une séance' : 'Vendre un abonnement'} subtitle="Le montant et la période sont calculés par le serveur." />

      <div className="grid max-w-xl grid-cols-2 gap-1 rounded-2xl bg-slate-900/[0.05] p-1.5 dark:bg-white/5">
        {(['abonnement', 'seance'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={cx('flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold transition sm:text-[15px]', (t === 'seance') === isTicket ? 'bg-white text-slate-900 shadow-card dark:bg-ink-700 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white')}
          >
            {t === 'seance' ? <><Ticket className="size-4" /> Séance unique</> : <><CreditCard className="size-4" /> Abonnement</>}
          </button>
        ))}
      </div>

      {cash.data === null && (
        <Alert tone="amber" title="Caisse fermée">
          Aucune vente n'est possible sans session de caisse ouverte. <Link to="/caisse" className="font-bold underline">Ouvrir ma caisse</Link>
        </Alert>
      )}
      {error && (
        <Alert title="Vente refusée">
          {error.status === 403 ? error.message : error.errors ? Object.values(error.errors).flat().join(' ') : error.message}
        </Alert>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-6">
      {/* 1. Membre */}
      <Card title={<Step n={1} label={isTicket ? 'Membre (facultatif)' : 'Membre'} done={Boolean(member.data)} />}>
        {member.data ? (
          <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.03]">
            <Avatar url={member.data.photo_url} name={member.data.nom_complet} />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold">{member.data.nom_complet}</p>
              <p className="text-sm text-slate-500">
                {member.data.telephone_affiche} ·{' '}
                {member.data.couvert_jusqu_au ? `couvert jusqu'au ${date(member.data.couvert_jusqu_au)}` : 'aucun abonnement en cours'}
              </p>
            </div>
            <Button variant="secondary" onClick={() => selectMember(null)}>Changer</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <MemberSearch onSelect={selectMember} autoFocus={!isTicket} />
            <ButtonLink to="/membres/nouveau" variant="ghost" icon={UserPlus}>Créer un nouveau membre</ButtonLink>
          </div>
        )}
      </Card>

      {/* 2. Formule */}
      {(isTicket || member.data) && (
        <Card title={<Step n={2} label="Formule" done={Boolean(plan)} />}>
          <div className="grid gap-3 sm:grid-cols-2">
            {availablePlans.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlanId(p.id)}
                className={cx(
                  'relative rounded-2xl border-2 p-4 text-left transition duration-200',
                  plan?.id === p.id
                    ? 'border-brand-500 bg-brand-50/70 shadow-[0_0_0_4px_rgb(16_196_138/0.12)] dark:bg-brand-500/10'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/[0.03]',
                )}
              >
                {plan?.id === p.id && <CheckCircle2 className="absolute top-3 right-3 size-5 text-brand-600" />}
                <span className="block text-sm font-semibold text-slate-500 dark:text-slate-400">{p.est_seance ? 'Jour même' : `${p.duree_jours} jours`}</span>
                <span className="mt-0.5 block text-lg font-extrabold text-slate-900 dark:text-white">{p.nom}</span>
                <span className="tabular mt-2 block text-xl font-extrabold text-brand-700 dark:text-brand-400">{fcfa(p.prix_fcfa)}</span>
              </button>
            ))}
          </div>
          {!isTicket && quote.data && (
            <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-sky-50 p-4 text-sky-950 ring-1 ring-sky-200/70 dark:bg-sky-500/10 dark:text-sky-100 dark:ring-sky-500/20">
              <CalendarRange className="size-5 text-sky-600" /> Période : du <strong>{date(quote.data.date_debut)}</strong> au <strong>{date(quote.data.date_fin)}</strong>
              {quote.data.renouvellement_anticipe && <span className="block w-full text-sm opacity-80">Renouvellement anticipé : la nouvelle période commence à la fin de l'abonnement en cours.</span>}
            </p>
          )}
        </Card>
      )}

      {/* 3. Paiement */}
      {plan && (isTicket || member.data) && (
        <Card title={<Step n={3} label="Paiement" />}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(MODES).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                className={cx(
                  'flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 text-sm font-bold transition',
                  mode === value
                    ? 'border-brand-500 bg-brand-50/70 text-brand-800 shadow-[0_0_0_4px_rgb(16_196_138/0.12)] dark:bg-brand-500/10 dark:text-brand-300'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-300',
                )}
              >
                {(() => { const Icon = MODE_ICONS[value] ?? Wallet; return <Icon className="size-6" /> })()}
                {label}
              </button>
            ))}
          </div>

          {(needsReference || mode === 'autre') && (
            <div className="mt-4">
              <Field label={`Référence de la transaction ${MODES[mode]}`} required={needsReference} hint="Recopiez la référence exacte du SMS de confirmation." error={error?.field('reference_transaction')}>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} autoComplete="off" />
              </Field>
            </div>
          )}

          <div className="mt-4">
            {!showReduction ? (
              <Button variant="ghost" icon={Percent} onClick={() => setShowReduction(true)}>Appliquer une réduction (autorisation du patron)</Button>
            ) : (
              <div className="space-y-4 rounded-2xl bg-amber-50/80 p-4 ring-1 ring-amber-200/80 dark:bg-amber-500/10 dark:ring-amber-500/20">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Réduction (FCFA)">
                    <Input type="number" inputMode="numeric" min={0} value={reduction} onChange={(e) => setReduction(e.target.value)} />
                  </Field>
                  <Field label="Motif" required>
                    <Input value={motifReduction} onChange={(e) => setMotifReduction(e.target.value)} />
                  </Field>
                </div>
                {user?.role !== 'admin' && (
                  <>
                    <p className="text-sm font-semibold">Le patron saisit ses identifiants sur ce poste pour autoriser la réduction :</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Identifiant admin"><Input value={adminId} onChange={(e) => setAdminId(e.target.value)} autoComplete="off" /></Field>
                      <Field label="Mot de passe admin"><Input type="password" value={adminPwd} onChange={(e) => setAdminPwd(e.target.value)} autoComplete="off" /></Field>
                    </div>
                  </>
                )}
                <Button variant="ghost" onClick={() => { setShowReduction(false); setReduction(''); setMotifReduction('') }}>Retirer la réduction</Button>
              </div>
            )}
          </div>
        </Card>
      )}

      </div>

      {/* Récapitulatif */}
      <aside className="xl:sticky xl:top-24">
        <section className="relative animate-rise overflow-hidden rounded-card bg-ink-gradient p-6 text-white shadow-pop">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" />
          <div className="absolute -top-20 -right-20 size-56 rounded-full bg-brand-500/25 blur-[70px]" />
          <div className="relative">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-gradient shadow-glow"><Receipt className="size-5" /></span>
            <h2 className="text-lg font-bold">Récapitulatif</h2>
          </div>
          {!plan || !(isTicket || member.data) ? (
            <p className="text-sm text-slate-400">{isTicket ? 'Choisissez une formule pour continuer.' : 'Choisissez un membre puis une formule.'}</p>
          ) : (<>
          <dl className="space-y-2.5 text-[15px]">
            {member.data && <Row label="Membre" value={member.data.nom_complet} />}
            <Row label="Formule" value={plan.nom} />
            <Row label="Montant dû" value={fcfa(montantDu)} />
            {reductionValue > 0 && <Row label="Réduction" value={`− ${fcfa(reductionValue)}`} />}
            <Row label="Mode" value={MODES[mode]} />
          </dl>
          <div className="my-5 border-t border-dashed border-white/15" />
          <p className="text-sm text-slate-400">À encaisser</p>
          <p className="tabular text-4xl font-extrabold tracking-tight">{fcfa(aEncaisser)}</p>
          <Button
            size="lg"
            className="mt-6 w-full"
            icon={Banknote}
            disabled={!cash.data || (needsReference && !reference.trim()) || (reductionValue > 0 && motifReduction.trim().length < 3)}
            onClick={() => setConfirmOpen(true)}
          >
            Encaisser
          </Button>
          {!cash.data && <p className="mt-3 text-center text-sm text-amber-300">Ouvrez votre caisse pour encaisser.</p>}
          </>)}
          </div>
        </section>
      </aside>
      </div>

      <Modal
        open={confirmOpen}
        title="Confirmer l'encaissement"
        onClose={() => setConfirmOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Retour</Button>
            <Button onClick={submit} loading={submitting}>Confirmer</Button>
          </>
        }
      >
        <p className="text-lg">
          Avez-vous bien reçu <strong>{fcfa(aEncaisser)}</strong> en <strong>{MODES[mode]}</strong>
          {member.data ? <> de <strong>{member.data.nom_complet}</strong></> : null} ?
        </p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Un paiement enregistré ne peut plus être modifié : seul le patron peut l'annuler, avec un motif.</p>
      </Modal>
    </div>
  )
}

const MODE_ICONS: Record<string, LucideIcon> = { especes: Banknote, wave: Smartphone, orange_money: Smartphone, autre: Wallet }

/** Titre d'étape numérotée (coche quand l'étape est remplie). */
function Step({ n, label, done }: { n: number; label: string; done?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <span className={cx('flex size-8 items-center justify-center rounded-full text-sm font-extrabold', done ? 'bg-brand-gradient text-white shadow-glow' : 'bg-slate-900/[0.06] text-slate-600 dark:bg-white/10 dark:text-slate-300')}>
        {done ? <CheckCircle2 className="size-4" /> : n}
      </span>
      {label}
    </span>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-semibold text-white">{value}</dd>
    </div>
  )
}

function SaleDone({ payment, onNew }: { payment: Payment; onNew: () => void }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="animate-pop text-center">
        <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-brand-gradient text-white shadow-glow"><CheckCircle2 className="size-10" /></span>
        <h1 className="mt-5 text-3xl font-extrabold text-slate-900 dark:text-white">Paiement enregistré</h1>
        <p className="tabular mt-2 text-lg text-slate-500 dark:text-slate-400">{payment.numero_recu} · {fcfa(payment.montant_encaisse)} · {payment.mode_libelle}</p>
      </div>
      <Alert tone="green" title="Reçu prêt à imprimer">
        Reçu <strong>{payment.numero_recu}</strong> — {fcfa(payment.montant_encaisse)} ({payment.mode_libelle})
      </Alert>
      <Card>
        {payment.abonnement && (
          <p className="text-lg">
            Abonnement <strong>{payment.plan?.nom}</strong> du <strong>{date(payment.abonnement.date_debut)}</strong> au <strong>{date(payment.abonnement.date_fin)}</strong>.
          </p>
        )}
        {payment.ticket && (
          <p className="text-lg">Ticket <strong>{payment.ticket.numero}</strong> valable aujourd'hui ({date(payment.ticket.valable_le)}) pour une entrée.</p>
        )}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button size="lg" icon={Printer} onClick={() => openDocument(`payments/${payment.id}/receipt`)}>Reçu A5 (PDF)</Button>
          <Button size="lg" variant="secondary" onClick={() => openDocument(`payments/${payment.id}/receipt?format=80mm`)}>Ticket de caisse 80 mm</Button>
          {payment.ticket && <ButtonLink to={`/tickets/${payment.ticket.id}`} size="lg" variant="secondary">Afficher le QR / WhatsApp</ButtonLink>}
          {payment.member && <ButtonLink to={`/membres/${payment.member.id}`} size="lg" variant="secondary">Fiche du membre</ButtonLink>}
          {payment.member && <Button size="lg" variant="secondary" onClick={() => openDocument(`members/${payment.member!.id}/card`)}>Carte de membre (QR)</Button>}
        </div>
      </Card>
      <Button size="lg" variant="ghost" onClick={onNew}>Nouvelle vente</Button>
    </div>
  )
}

