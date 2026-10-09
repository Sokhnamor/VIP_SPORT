<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** Création et modification d'un membre (en modification, seuls les champs envoyés sont validés). */
class MemberRequest extends FormRequest
{
    public function rules(): array
    {
        // La modification accepte aussi POST (envoi multipart de la photo) : on se base sur la route.
        $required = $this->routeIs('members.store') ? 'required' : 'sometimes';

        return [
            'nom' => [$required, 'string', 'max:100'],
            'prenom' => [$required, 'string', 'max:100'],
            // Format vérifié et normalisé par MemberService (Phone::normalize).
            'telephone' => [$required, 'string', 'max:25'],
            'email' => ['nullable', 'email', 'max:255'],
            'date_naissance' => ['nullable', 'date', 'before:today', 'after:1900-01-01'],
            'sexe' => ['nullable', 'in:M,F'],
            'contact_urgence' => ['nullable', 'string', 'max:150'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'photo' => ['nullable', 'image', 'mimes:jpeg,png,webp', 'max:'.config('gym.max_upload_kb')],
        ];
    }

    /** Données du membre, sans le fichier photo. */
    public function memberData(): array
    {
        return collect($this->validated())->except('photo')->all();
    }
}
