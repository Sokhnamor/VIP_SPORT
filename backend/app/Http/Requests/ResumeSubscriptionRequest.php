<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ResumeSubscriptionRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            // Prolongation manuelle de la durée suspendue (tracée dans l'audit).
            'date_fin' => ['nullable', 'date_format:Y-m-d'],
            'motif' => ['required_with:date_fin', 'nullable', 'string', 'max:1000'],
        ];
    }
}
