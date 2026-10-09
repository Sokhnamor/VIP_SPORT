<?php

namespace App\Http\Requests;

use App\Enums\Role;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UserRequest extends FormRequest
{
    public function rules(): array
    {
        $creating = $this->isMethod('post');
        $required = $creating ? 'required' : 'sometimes';

        return [
            'nom' => [$required, 'string', 'max:100'],
            'identifiant' => [$required, 'string', 'max:255', 'regex:/^[A-Za-z0-9._@-]+$/', Rule::unique('users', 'identifiant')->ignore($this->route('user'))],
            'role' => [$required, Rule::enum(Role::class)],
            'actif' => ['sometimes', 'boolean'],
            'mot_de_passe' => [$creating ? 'required' : 'prohibited', 'string', Password::defaults()],
        ];
    }

    public function messages(): array
    {
        return ['identifiant.regex' => 'L\'identifiant ne peut contenir que lettres, chiffres, points, tirets, @ et _.'];
    }
}
