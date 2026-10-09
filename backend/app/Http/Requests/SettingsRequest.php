<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SettingsRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'nom_salle' => ['sometimes', 'string', 'max:100'],
            'adresse' => ['sometimes', 'nullable', 'string', 'max:255'],
            'telephone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'heure_ouverture' => ['sometimes', 'date_format:H:i'],
            'heure_fermeture' => ['sometimes', 'date_format:H:i'],
            'une_entree_par_jour' => ['sometimes', 'boolean'],
            'mode_sortie' => ['sometimes', 'boolean'],
            'seuil_alerte_expiration' => ['sometimes', 'integer', 'min:1', 'max:60'],
        ];
    }
}
