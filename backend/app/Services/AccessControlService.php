<?php

namespace App\Services;

use App\Enums\AccessType;
use App\Enums\ScanResult;
use App\Enums\SubscriptionStatus;
use App\Enums\TicketStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\AccessLog;
use App\Models\Member;
use App\Models\Presence;
use App\Models\Ticket;
use App\Models\User;
use App\Support\Dates;
use App\Support\Settings;
use App\Support\Token;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Contrôle d'accès : toute la décision est prise ici, côté serveur. Le poste de scan
 * n'envoie que le contenu brut du QR. Chaque tentative est journalisée, refus compris.
 */
class AccessControlService
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function scan(string $raw, AccessType $type, User $user, ?string $ip): ScanOutcome
    {
        $token = Token::normalizeInput($raw);

        if ($type === AccessType::Sortie && ! Settings::get('mode_sortie')) {
            throw new BusinessRuleException('Le mode sortie n\'est pas activé dans les paramètres.', 'SORTIE_DESACTIVEE');
        }

        [$member, $ticket] = $this->resolve($token);

        if (! $member && ! $ticket) {
            $outcome = new ScanOutcome(ScanResult::RefuseInconnu, 'QR inconnu ou invalide', $type);

            return $this->record($outcome, $user, $ip, $token);
        }

        $outcome = match (true) {
            $type === AccessType::Sortie => $this->exit($member, $ticket),
            $member !== null => $this->evaluateMember($member),
            default => $this->evaluateTicket($ticket),
        };

        return DB::transaction(fn () => $this->finalize($outcome, $user, $ip, $token, manual: false));
    }

    /**
     * Entrée manuelle exceptionnelle (QR illisible…) : mêmes règles que le scan, motif obligatoire,
     * enregistrement marqué « manuel ». La règle d'or reste appliquée : un abonnement non valide est refusé.
     */
    public function manualEntry(Member $member, string $motif, User $user, ?string $ip): ScanOutcome
    {
        if ($member->isArchived()) {
            $outcome = new ScanOutcome(ScanResult::RefuseInconnu, 'Membre archivé', AccessType::Entree, $member);

            return $this->record($outcome, $user, $ip, null, manual: true, motif: $motif);
        }

        $outcome = $this->evaluateMember($member);

        $outcome = DB::transaction(fn () => $this->finalize($outcome, $user, $ip, null, manual: true, motif: $motif));

        $this->audit->log('acces.entree_manuelle', $member, null, [
            'resultat' => $outcome->result->value,
            'motif' => $motif,
        ], $user);

        return $outcome;
    }

    /** @return array{0: ?Member, 1: ?Ticket} */
    private function resolve(string $token): array
    {
        if ($token === '' || strlen($token) > 64) {
            return [null, null];
        }

        if (str_starts_with($token, Token::MEMBER_PREFIX)) {
            $member = Member::query()->where('qr_token', $token)->first();

            // Membre archivé ou anonymisé : son QR n'ouvre plus rien.
            return [$member && ! $member->isArchived() ? $member : null, null];
        }

        if (str_starts_with($token, Token::TICKET_PREFIX)) {
            // Saisie manuelle du numéro court (T-XXXXXXXX) ou jeton complet du QR.
            $column = strlen($token) === 10 ? 'numero' : 'qr_token';

            return [null, Ticket::query()->where($column, $token)->first()];
        }

        return [null, null];
    }

    private function evaluateMember(Member $member): ScanOutcome
    {
        $today = Dates::todayString();
        $current = $member->currentSubscription();

        if ($current) {
            if ($current->statut === SubscriptionStatus::Suspendu) {
                return new ScanOutcome(ScanResult::RefuseSuspendu, 'Abonnement suspendu', member: $member, subscription: $current);
            }

            $fin = $member->coveredUntil() ?? $current->date_fin->toDateString();
            $jours = (int) CarbonImmutable::parse($today)->diffInDays(CarbonImmutable::parse($fin));
            $alerte = $jours <= (int) config('gym.scan_alert_days', 3);

            return new ScanOutcome(
                $alerte ? ScanResult::AccepteAlerte : ScanResult::Accepte,
                $alerte
                    ? ($jours === 0 ? 'Bienvenue — abonnement expire ce soir' : "Bienvenue — expire dans {$jours} jour(s)")
                    : 'Bienvenue',
                member: $member,
                subscription: $current,
                dateFin: $fin,
                joursRestants: $jours,
            );
        }

        // Aucun abonnement valide aujourd'hui : on explique pourquoi.
        $covering = $member->subscriptions()
            ->whereDate('date_debut', '<=', $today)
            ->whereDate('date_fin', '>=', $today)
            ->latest('id')
            ->first();

        if ($covering?->statut === SubscriptionStatus::Annule) {
            return new ScanOutcome(ScanResult::RefuseAnnule, 'Abonnement annulé', member: $member, subscription: $covering);
        }

        $last = $member->subscriptions()
            ->where('statut', '!=', SubscriptionStatus::Annule->value)
            ->whereDate('date_fin', '<', $today)
            ->orderByDesc('date_fin')
            ->first();

        if ($last) {
            $fin = $last->date_fin->toDateString();

            return new ScanOutcome(
                ScanResult::RefuseExpire,
                'Abonnement expiré le '.CarbonImmutable::parse($fin)->format('d/m/Y'),
                member: $member,
                subscription: $last,
                dateFin: $fin,
                joursRestants: 0,
            );
        }

        $hasCancelled = $member->subscriptions()->where('statut', SubscriptionStatus::Annule->value)->exists();
        if ($hasCancelled) {
            return new ScanOutcome(ScanResult::RefuseAnnule, 'Abonnement annulé', member: $member);
        }

        $future = $member->subscriptions()
            ->where('statut', SubscriptionStatus::Actif->value)
            ->whereDate('date_debut', '>', $today)
            ->orderBy('date_debut')
            ->first();

        if ($future) {
            return new ScanOutcome(
                ScanResult::RefuseExpire,
                'Abonnement pas encore commencé (début le '.$future->date_debut->format('d/m/Y').')',
                member: $member,
                subscription: $future,
            );
        }

        return new ScanOutcome(ScanResult::RefuseExpire, 'Aucun abonnement payé', member: $member);
    }

    private function evaluateTicket(Ticket $ticket): ScanOutcome
    {
        $today = Dates::todayString();

        return match (true) {
            $ticket->statut === TicketStatus::Annule => new ScanOutcome(ScanResult::RefuseAnnule, 'Ticket annulé', ticket: $ticket),
            $ticket->statut === TicketStatus::Utilise => new ScanOutcome(
                ScanResult::TicketUtilise,
                'Ticket déjà utilisé'.($ticket->utilise_at ? ' à '.$ticket->utilise_at->setTimezone(Dates::timezone())->format('H:i') : ''),
                ticket: $ticket,
            ),
            $ticket->valable_le->toDateString() !== $today => new ScanOutcome(
                ScanResult::TicketExpire,
                'Ticket valable le '.$ticket->valable_le->format('d/m/Y').' uniquement',
                ticket: $ticket,
            ),
            default => new ScanOutcome(ScanResult::Accepte, 'Séance unique — bienvenue', ticket: $ticket, dateFin: $today, joursRestants: 0),
        };
    }

    /** Sortie : jamais refusée pour un motif d'abonnement, on clôture la présence ouverte. */
    private function exit(?Member $member, ?Ticket $ticket): ScanOutcome
    {
        return new ScanOutcome(ScanResult::Accepte, 'Au revoir', AccessType::Sortie, $member, $ticket);
    }

    /**
     * Applique les règles qui dépendent de l'historique (re-scan < 2 min, une entrée par jour,
     * ticket consommé), puis journalise et crée la présence. Exécuté en transaction.
     */
    private function finalize(ScanOutcome $outcome, User $user, ?string $ip, ?string $token, bool $manual, ?string $motif = null): ScanOutcome
    {
        if ($outcome->type === AccessType::Sortie) {
            return $this->finalizeExit($outcome, $user, $ip, $token);
        }

        if ($outcome->result->isAccepted()) {
            $outcome = $this->applyHistoryRules($outcome);
        }

        // Ticket : consommation atomique (deux scans simultanés → un seul accepté).
        if ($outcome->result->isAccepted() && $outcome->ticket) {
            $updated = Ticket::query()
                ->whereKey($outcome->ticket->id)
                ->where('statut', TicketStatus::Valide->value)
                ->update(['statut' => TicketStatus::Utilise->value, 'utilise_at' => now(), 'updated_at' => now()]);

            if ($updated === 0) {
                $outcome = new ScanOutcome(ScanResult::TicketUtilise, 'Ticket déjà utilisé', ticket: $outcome->ticket);
            }
        }

        $this->record($outcome, $user, $ip, $token, $manual, $motif);

        if ($outcome->result->isAccepted()) {
            Presence::create([
                'member_id' => $outcome->member?->id,
                'ticket_id' => $outcome->ticket?->id,
                'access_log_id' => $outcome->log->id,
                'entree_at' => $outcome->log->scanned_at,
            ]);
        }

        return $outcome;
    }

    private function applyHistoryRules(ScanOutcome $outcome): ScanOutcome
    {
        if (! $outcome->member) {
            return $outcome;
        }

        $accepted = [ScanResult::Accepte->value, ScanResult::AccepteAlerte->value];
        $entries = AccessLog::query()
            ->where('member_id', $outcome->member->id)
            ->where('type', AccessType::Entree->value)
            ->whereIn('resultat', $accepted);

        $window = (int) config('gym.rescan_window_seconds', 120);
        $recent = (clone $entries)->where('scanned_at', '>=', now()->subSeconds($window))->exists();

        if ($recent) {
            return new ScanOutcome(
                ScanResult::DejaScanne,
                'Déjà scanné il y a moins de 2 minutes',
                member: $outcome->member,
                subscription: $outcome->subscription,
                dateFin: $outcome->dateFin,
                joursRestants: $outcome->joursRestants,
            );
        }

        if (Settings::get('une_entree_par_jour')) {
            [$start, $end] = Dates::dayBoundsUtc(Dates::todayString());
            if ((clone $entries)->whereBetween('scanned_at', [$start, $end])->exists()) {
                return new ScanOutcome(
                    ScanResult::RefuseQuotaJour,
                    'Déjà entré aujourd\'hui (une entrée par jour)',
                    member: $outcome->member,
                    subscription: $outcome->subscription,
                );
            }
        }

        return $outcome;
    }

    private function finalizeExit(ScanOutcome $outcome, User $user, ?string $ip, ?string $token): ScanOutcome
    {
        $this->record($outcome, $user, $ip, $token);

        $presence = Presence::query()
            ->whereNull('sortie_at')
            ->when($outcome->member, fn ($q) => $q->where('member_id', $outcome->member->id))
            ->when(! $outcome->member && $outcome->ticket, fn ($q) => $q->where('ticket_id', $outcome->ticket->id))
            ->latest('entree_at')
            ->first();

        $presence?->update(['sortie_at' => now()]);

        return $presence ? $outcome : new ScanOutcome(
            $outcome->result, 'Au revoir (aucune entrée ouverte trouvée)', AccessType::Sortie,
            $outcome->member, $outcome->ticket, log: $outcome->log,
        );
    }

    private function record(ScanOutcome $outcome, User $user, ?string $ip, ?string $token, bool $manual = false, ?string $motif = null): ScanOutcome
    {
        $outcome->log = AccessLog::create([
            'member_id' => $outcome->member?->id,
            'ticket_id' => $outcome->ticket?->id,
            'subscription_id' => $outcome->subscription?->id,
            'token_scanne' => $token !== null ? Str::limit($token, 100, '') : null,
            'resultat' => $outcome->result,
            'type' => $outcome->type,
            'manuel' => $manual,
            'motif_manuel' => $motif,
            'user_id' => $user->id,
            'scanned_at' => now(),
            'ip' => $ip,
        ]);

        return $outcome;
    }

    /** Clôture automatique des présences encore ouvertes (heure de fermeture ou jours passés). */
    public function closeOpenPresences(): int
    {
        $now = Dates::now();
        [$hour, $minute] = array_map('intval', explode(':', (string) Settings::get('heure_fermeture')));
        $closingToday = $now->setTime($hour, $minute);

        $query = Presence::query()->whereNull('sortie_at');

        if ($now->lt($closingToday)) {
            // Avant la fermeture : seules les présences des jours précédents sont clôturées.
            $query->where('entree_at', '<', Dates::today()->utc());
        }

        return $query->update([
            'sortie_at' => now(),
            'cloture_auto' => true,
            'updated_at' => now(),
        ]);
    }
}
