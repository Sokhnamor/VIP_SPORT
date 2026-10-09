<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class ChangePasswordRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'mot_de_passe_actuel' => ['required', 'string', 'current_password:web'],
            'nouveau_mot_de_passe' => ['required', 'string', 'confirmed', 'different:mot_de_passe_actuel', Password::defaults()],
        ];
    }

    public function attributes(): array
    {
        return [
            'mot_de_passe_actuel' => 'mot de passe actuel',
            'nouveau_mot_de_passe' => 'nouveau mot de passe',
        ];
    }
}
