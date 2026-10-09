<?php

namespace App\Services;

use App\Enums\MemberStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Member;
use App\Models\User;
use App\Support\Dates;
use App\Support\Phone;
use App\Support\Text;
use App\Support\Token;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\UploadedFile;
use Illuminate\Pagination\LengthAwarePaginator as Paginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class MemberService
{
    /** Disque privé : les photos ne sont jamais dans le dossier public. */
    public const DISK = 'local';

    public function __construct(private readonly AuditLogger $audit) {}

    public function create(array $data, ?UploadedFile $photo, User $user): Member
    {
        $data['telephone'] = $this->normalizedPhone($data['telephone'] ?? null);
        $this->assertPhoneAvailable($data['telephone']);

        return DB::transaction(function () use ($data, $photo, $user) {
            $member = new Member($data);
            $member->date_inscription = $data['date_inscription'] ?? Dates::todayString();
            $member->statut = MemberStatus::Actif;
            $member->created_by = $user->id;

            if ($photo) {
                $member->photo_path = $this->storePhoto($photo);
            }
            $member->save();

            $this->audit->log('membre.creation', $member, null, $member->only([
                'nom', 'prenom', 'telephone', 'email', 'date_naissance', 'sexe', 'contact_urgence',
            ]), $user);

            return $member;
        });
    }

    public function update(Member $member, array $data, ?UploadedFile $photo, User $user): Member
    {
        if (array_key_exists('telephone', $data)) {
            $data['telephone'] = $this->normalizedPhone($data['telephone']);
            $this->assertPhoneAvailable($data['telephone'], $member->id);
        }

        return DB::transaction(function () use ($member, $data, $photo, $user) {
            $member->fill($data);
            $oldPhoto = null;
            if ($photo) {
                $oldPhoto = $member->photo_path;
                $member->photo_path = $this->storePhoto($photo);
            }

            [$avant, $apres] = $this->audit->diff($member);
            unset($avant['recherche'], $apres['recherche']);
            $member->save();

            if ($apres !== []) {
                $this->audit->log('membre.modification', $member, $avant, $apres, $user);
            }

            if ($oldPhoto) {
                Storage::disk(self::DISK)->delete($oldPhoto);
            }

            return $member;
        });
    }

    public function setArchived(Member $member, bool $archived, User $admin): Member
    {
        if ($member->anonymise_at && ! $archived) {
            throw new BusinessRuleException('Un membre anonymisé ne peut pas être réactivé.', 'MEMBRE_ANONYMISE');
        }

        $member->statut = $archived ? MemberStatus::Archive : MemberStatus::Actif;
        [$avant, $apres] = $this->audit->diff($member);
        $member->save();

        $this->audit->log($archived ? 'membre.archivage' : 'membre.reactivation', $member, $avant, $apres, $admin);

        return $member;
    }

    /**
     * Anonymisation (données personnelles) : l'historique financier et des accès est conservé,
     * mais l'identité est effacée et le QR désactivé.
     */
    public function anonymize(Member $member, User $admin): Member
    {
        return DB::transaction(function () use ($member, $admin) {
            $photo = $member->photo_path;

            $member->forceFill([
                'nom' => 'Anonyme',
                'prenom' => 'Membre #'.$member->id,
                'telephone' => 'ANONYME-'.$member->id,
                'email' => null,
                'date_naissance' => null,
                'sexe' => null,
                'photo_path' => null,
                'contact_urgence' => null,
                'notes' => null,
                'qr_token' => null,
                'statut' => MemberStatus::Archive,
                'anonymise_at' => now(),
            ])->save();

            if ($photo) {
                Storage::disk(self::DISK)->delete($photo);
            }

            $this->audit->log('membre.anonymisation', $member, null, ['anonymise' => true], $admin);

            return $member;
        });
    }

    /** Carte perdue : nouveau jeton, l'ancien est refusé immédiatement. */
    public function regenerateToken(Member $member, User $admin): Member
    {
        if (! $member->qr_token) {
            throw new BusinessRuleException(
                'Ce membre n\'a pas encore de QR : il est créé au premier paiement d\'abonnement.',
                'QR_ABSENT',
            );
        }

        $member->forceFill(['qr_token' => Token::member(), 'qr_genere_at' => now()])->save();

        $this->audit->log('membre.qr_regenere', $member, null, ['qr_genere_at' => $member->qr_genere_at], $admin);

        return $member;
    }

    /**
     * Recherche tolérante : sans accents ni casse, chaque mot doit apparaître (nom, prénom ou
     * téléphone). Sans résultat, repli sur une recherche approchée (fautes de frappe).
     */
    public function search(?string $query, bool $includeArchived = false, int $perPage = 20): LengthAwarePaginator
    {
        $base = Member::query()
            ->when(! $includeArchived, fn ($q) => $q->where('statut', MemberStatus::Actif->value))
            ->orderBy('nom')
            ->orderBy('prenom');

        $terms = array_filter(explode(' ', Text::normalize($query)));
        if ($terms === []) {
            return $base->paginate($perPage);
        }

        $exact = (clone $base);
        foreach ($terms as $term) {
            $exact->where('recherche', 'like', '%'.$term.'%');
        }

        $result = $exact->paginate($perPage);
        if ($result->total() > 0) {
            return $result;
        }

        return $this->fuzzySearch($base, $terms, $perPage);
    }

    /**
     * Repli approché : distance de Levenshtein ≤ 2 (≤ 1 pour les mots courts) entre chaque
     * terme et au moins un mot de la fiche. Suffisant pour quelques milliers de membres.
     *
     * @param  list<string>  $terms
     */
    private function fuzzySearch($base, array $terms, int $perPage): LengthAwarePaginator
    {
        $matches = [];
        (clone $base)->select(['id', 'recherche'])->chunk(1000, function ($members) use ($terms, &$matches) {
            foreach ($members as $member) {
                $words = explode(' ', $member->recherche);
                $score = 0;
                foreach ($terms as $term) {
                    $best = PHP_INT_MAX;
                    foreach ($words as $word) {
                        $best = min($best, levenshtein($term, substr($word, 0, strlen($term) + 2)));
                    }
                    $tolerance = strlen($term) <= 4 ? 1 : 2;
                    if ($best > $tolerance) {
                        return;
                    }
                    $score += $best;
                }
                $matches[$member->id] = $score;
            }
        });

        asort($matches);
        $ids = array_slice(array_keys($matches), 0, $perPage);
        $items = Member::query()->whereIn('id', $ids)->get()->sortBy(fn ($m) => $matches[$m->id])->values();

        return new Paginator($items, count($matches), $perPage, 1);
    }

    private function normalizedPhone(?string $raw): string
    {
        $phone = Phone::normalize($raw);
        if (! $phone) {
            throw ValidationException::withMessages([
                'telephone' => 'Numéro sénégalais invalide (ex. 77 123 45 67).',
            ]);
        }

        return $phone;
    }

    private function assertPhoneAvailable(string $phone, ?int $ignoreId = null): void
    {
        $existing = Member::query()
            ->where('telephone', $phone)
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->first();

        if ($existing) {
            throw new BusinessRuleException(
                "Ce numéro appartient déjà à {$existing->nom_complet}.",
                'TELEPHONE_DOUBLON',
                409,
                ['member_id' => $existing->id],
            );
        }
    }

    private function storePhoto(UploadedFile $photo): string
    {
        return $photo->store('members/photos', self::DISK);
    }
}
