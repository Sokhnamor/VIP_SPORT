import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { MemberSearch } from '../../components/MemberSearch'
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
    <div className="max-w-3xl space-y-5">
      <PageHeader title={isTicket ? 'Vendre une séance' : 'Vendre un abonnement'} />

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-200 p-1 dark:bg-slate-800">
        {(['abonnement', 'seance'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={cx('min-h-12 rounded-xl font-bold', (t === 'seance') === isTicket ? 'bg-white shadow dark:bg-slate-950' : 'text-slate-600 dark:text-slate-400')}
          >
            {t === 'seance' ? 'Séance unique (ticket)' : 'Abonnement / renouvellement'}
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

      {/* 1. Membre */}
      <Card title={isTicket ? '1. Membre (facultatif)' : '1. Membre'}>
        {member.data ? (
          <div className="flex flex-wrap items-center gap-3">
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
            <ButtonLink to="/membres/nouveau" variant="ghost">+ Créer un nouveau membre</ButtonLink>
          </div>
        )}
      </Card>

      {/* 2. Formule */}
      {(isTicket || member.data) && (
        <Card title="2. Formule">
          <div className="grid gap-2 sm:grid-cols-2">
            {availablePlans.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlanId(p.id)}
                className={cx(
                  'min-h-16 rounded-xl p-3 text-left ring-2 transition',
                  plan?.id === p.id ? 'bg-brand-50 ring-brand-600 dark:bg-brand-800/30' : 'ring-slate-200 hover:ring-slate-400 dark:ring-slate-700',
                )}
              >
                <span className="block font-bold">{p.nom}</span>
                <span className="block text-slate-600 dark:text-slate-400">{fcfa(p.prix_fcfa)}{!p.est_seance && ` · ${p.duree_jours} jours`}</span>
              </button>
            ))}
          </div>
          {!isTicket && quote.data && (
            <p className="mt-3 rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
              Période : du <strong>{date(quote.data.date_debut)}</strong> au <strong>{date(quote.data.date_fin)}</strong>
              {quote.data.renouvellement_anticipe && <span className="block text-sm text-slate-600 dark:text-slate-400">Renouvellement anticipé : la nouvelle période commence à la fin de l'abonnement en cours.</span>}
            </p>
          )}
        </Card>
      )}

      {/* 3. Paiement */}
      {plan && (isTicket || member.data) && (
        <Card title="3. Paiement">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(MODES).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                className={cx('min-h-14 rounded-xl font-bold ring-2', mode === value ? 'bg-brand-600 text-white ring-brand-600' : 'ring-slate-200 dark:ring-slate-700')}
              >
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
              <Button variant="ghost" onClick={() => setShowReduction(true)}>Appliquer une réduction (autorisation du patron)…</Button>
            ) : (
              <div className="space-y-3 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:ring-amber-900">
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

      {/* Récapitulatif */}
      {plan && (isTicket || member.data) && (
        <Card title="Récapitulatif">
          <dl className="space-y-1 text-lg">
            <Row label="Formule" value={plan.nom} />
            <Row label="Montant dû" value={fcfa(montantDu)} />
            {reductionValue > 0 && <Row label="Réduction" value={`− ${fcfa(reductionValue)}`} />}
            <Row label="Mode" value={MODES[mode]} />
            <div className="flex justify-between border-t border-slate-200 pt-2 text-2xl font-extrabold dark:border-slate-700">
              <dt>À encaisser</dt>
              <dd>{fcfa(aEncaisser)}</dd>
            </div>
          </dl>
          <Button
            size="lg"
            className="mt-4 w-full"
            disabled={!cash.data || (needsReference && !reference.trim()) || (reductionValue > 0 && motifReduction.trim().length < 3)}
            onClick={() => setConfirmOpen(true)}
          >
            Encaisser {fcfa(aEncaisser)}
          </Button>
        </Card>
      )}

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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-600 dark:text-slate-400">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  )
}

function SaleDone({ payment, onNew }: { payment: Payment; onNew: () => void }) {
  return (
    <div className="max-w-2xl space-y-5">
      <Alert tone="green" title="Paiement enregistré">
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
          <Button size="lg" onClick={() => openDocument(`payments/${payment.id}/receipt`)}>Reçu A5 (PDF)</Button>
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

