<?php

namespace App\Models;

use App\Enums\MemberStatus;
use App\Enums\SubscriptionStatus;
use App\Support\Dates;
use App\Support\Text;
use Carbon\CarbonImmutable;
use Database\Factories\MemberFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $nom
 * @property string $prenom
 * @property string $telephone
 * @property string|null $email
 * @property CarbonImmutable|null $date_naissance
 * @property string|null $sexe
 * @property string|null $photo_path
 * @property string|null $contact_urgence
 * @property string|null $notes
 * @property CarbonImmutable $date_inscription
 * @property string|null $qr_token
 * @property CarbonImmutable|null $qr_genere_at
 * @property MemberStatus $statut
 * @property string $recherche
 * @property CarbonImmutable|null $anonymise_at
 * @property int|null $created_by
 * @property-read string $nom_complet
 */
#[Fillable([
    'nom', 'prenom', 'telephone', 'email', 'date_naissance', 'sexe', 'photo_path',
    'contact_urgence', 'notes', 'date_inscription', 'statut', 'created_by',
])]
#[Hidden(['qr_token', 'recherche'])]
class Member extends Model
{
    /** @use HasFactory<MemberFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'date_naissance' => 'immutable_date',
            'date_inscription' => 'immutable_date',
            'qr_genere_at' => 'immutable_datetime',
            'anonymise_at' => 'immutable_datetime',
            'statut' => MemberStatus::class,
        ];
    }

    protected static function booted(): void
    {
        // Colonne de recherche toujours recalculée : nom, prénom et téléphone normalisés
        // (avec et sans indicatif, pour retrouver « 771234567 » comme « +221 77… »).
        static::saving(function (Member $member) {
            $phone = (string) $member->telephone;
            $member->recherche = Text::normalize(
                $member->nom.' '.$member->prenom.' '.ltrim($phone, '+').' '.substr($phone, 4)
            );
        });
    }

    public function getNomCompletAttribute(): string
    {
        return trim($this->prenom.' '.$this->nom);
    }

    /** @return HasMany<Subscription, $this> */
    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    /** @return HasMany<Payment, $this> */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /** @return HasMany<Ticket, $this> */
    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class);
    }

    /** @return HasMany<AccessLog, $this> */
    public function accessLogs(): HasMany
    {
        return $this->hasMany(AccessLog::class);
    }

    public function isArchived(): bool
    {
        return $this->statut === MemberStatus::Archive;
    }

    /** Abonnement non annulé qui couvre aujourd'hui, s'il existe. */
    public function currentSubscription(): ?Subscription
    {
        $today = Dates::todayString();

        return $this->subscriptions()
            ->where('statut', '!=', SubscriptionStatus::Annule->value)
            ->whereDate('date_debut', '<=', $today)
            ->whereDate('date_fin', '>=', $today)
            ->orderByDesc('date_fin')
            ->first();
    }

    /** Dernière date de fin couverte par un abonnement actif (enchaînements compris). */
    public function coveredUntil(): ?string
    {
        $last = $this->subscriptions()
            ->where('statut', SubscriptionStatus::Actif->value)
            ->whereDate('date_fin', '>=', Dates::todayString())
            ->max('date_fin');

        return $last ? substr((string) $last, 0, 10) : null;
    }
}
