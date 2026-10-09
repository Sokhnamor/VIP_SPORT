<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** Action sensible nécessitant un motif (annulation, suspension, rejet…). */
class ReasonRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'motif' => ['required', 'string', 'min:3', 'max:1000'],
        ];
    }
}
