<?php

namespace App\Http\Requests;

use App\Enums\PaymentMode;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Vente d'un abonnement ou d'une séance. Aucun montant dû n'est accepté du client :
 * le serveur le calcule à partir de la formule (PaymentService).
 */
class SaleRequest extends FormRequest
{
    public function rules(): array
    {
        $isTicket = $this->routeIs('sales.ticket');

        return [
            'member_id' => [$isTicket ? 'nullable' : 'required', 'integer', 'exists:members,id'],
            'plan_id' => ['required', 'integer', 'exists:plans,id'],
            'mode' => ['required', Rule::enum(PaymentMode::class)],
            'montant_encaisse' => ['required', 'integer', 'min:0'],
            'reference_transaction' => [
                Rule::requiredIf(fn () => in_array($this->input('mode'), [PaymentMode::Wave->value, PaymentMode::OrangeMoney->value], true)),
                'nullable', 'string', 'max:100', 'unique:payments,reference_transaction',
            ],
            'reduction' => ['sometimes', 'integer', 'min:0'],
            'motif_reduction' => ['required_with:reduction', 'nullable', 'string', 'max:500'],
            'autorisation' => ['sometimes', 'array'],
            'autorisation.identifiant' => ['sometimes', 'string', 'max:255'],
            'autorisation.mot_de_passe' => ['sometimes', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'reference_transaction.required' => 'La référence de transaction est obligatoire pour Wave et Orange Money.',
            'reference_transaction.unique' => 'Cette référence de transaction a déjà été utilisée.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('reference_transaction'))) {
            $this->merge(['reference_transaction' => trim($this->input('reference_transaction')) ?: null]);
        }
        if ((int) $this->input('reduction', 0) === 0) {
            $this->request->remove('reduction');
            $this->request->remove('motif_reduction');
        }
    }
}
