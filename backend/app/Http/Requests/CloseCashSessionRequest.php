<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CloseCashSessionRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'especes_comptees' => ['required', 'integer', 'min:0', 'max:100000000'],
            // Obligatoire si écart non nul : vérifié par CashSessionService (l'écart est calculé côté serveur).
            'motif_ecart' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
