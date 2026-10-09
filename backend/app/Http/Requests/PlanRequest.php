<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PlanRequest extends FormRequest
{
    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'nom' => [$required, 'string', 'max:100', Rule::unique('plans', 'nom')->ignore($this->route('plan'))],
            'duree_jours' => [$required, 'integer', 'min:1', 'max:3660'],
            // FCFA : entier, sans décimales.
            'prix_fcfa' => [$required, 'integer', 'min:0', 'max:100000000'],
            'est_seance' => ['sometimes', 'boolean'],
            'actif' => ['sometimes', 'boolean'],
        ];
    }
}
