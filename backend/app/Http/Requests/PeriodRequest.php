<?php

namespace App\Http\Requests;

use App\Support\Dates;
use Illuminate\Foundation\Http\FormRequest;

/** Filtre de période des rapports : du / au (dates locales incluses), export csv ou pdf. */
class PeriodRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'du' => ['nullable', 'date_format:Y-m-d'],
            'au' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:du'],
            'format' => ['nullable', 'in:json,csv,pdf'],
        ];
    }

    /** @return array{0: string, 1: string} */
    public function period(): array
    {
        $today = Dates::todayString();
        $from = $this->input('du') ?? $today;
        $to = $this->input('au') ?? ($this->input('du') ?? $today);

        return [$from, $to];
    }

    public function exportFormat(): string
    {
        return $this->input('format', 'json');
    }
}
