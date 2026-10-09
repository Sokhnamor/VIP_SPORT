<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'identifiant' => ['required', 'string', 'max:255'],
            'mot_de_passe' => ['required', 'string', 'max:255'],
        ];
    }
}
