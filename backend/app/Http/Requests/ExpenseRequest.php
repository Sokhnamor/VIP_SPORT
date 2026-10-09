<?php

namespace App\Http\Requests;

use App\Enums\ExpenseCategory;
use App\Enums\PaymentMode;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ExpenseRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'date_depense' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'categorie' => ['required', Rule::enum(ExpenseCategory::class)],
            'montant' => ['required', 'integer', 'min:1', 'max:100000000'],
            'description' => ['required', 'string', 'max:1000'],
            'mode' => ['required', Rule::enum(PaymentMode::class)],
            'payee_depuis_caisse' => ['sometimes', 'boolean'],
            'justificatif' => ['nullable', 'file', 'mimes:jpeg,png,webp,pdf', 'max:'.config('gym.max_upload_kb')],
        ];
    }
}
