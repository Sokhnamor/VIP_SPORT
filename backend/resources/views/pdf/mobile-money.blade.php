@php
    use App\Support\Dates;
    use App\Support\Money;
@endphp
@extends('pdf.layout')
@section('title', 'Rapprochement mobile money')

@push('styles')
<style>@page { margin: 28px; }</style>
@endpush

@section('content')
<h1>{{ $gym['nom_salle'] }} — Rapprochement Wave / Orange Money</h1>
<div class="muted">
    Session de caisse n° {{ $session->id }} — {{ $session->user->nom }} —
    ouverte le {{ Dates::displayDateTime($session->ouverte_at) }}
    @if($session->fermee_at), clôturée le {{ Dates::displayDateTime($session->fermee_at) }}@endif
</div>
<p class="small muted">Comparez chaque référence avec le relevé de l'opérateur et cochez la colonne « Vérifié ».</p>

@foreach(['wave' => 'Wave', 'orange_money' => 'Orange Money'] as $mode => $label)
    @php $rows = $payments->filter(fn ($p) => $p->mode->value === $mode); @endphp
    <h2>{{ $label }} ({{ $rows->count() }})</h2>
    <table class="grid">
        <thead>
        <tr><th>Heure</th><th>Reçu</th><th>Référence</th><th>Membre</th><th class="right">Montant</th><th>Statut</th><th>Vérifié</th></tr>
        </thead>
        <tbody>
        @forelse($rows as $p)
            <tr>
                <td>{{ Dates::displayDateTime($p->created_at) }}</td>
                <td>{{ $p->numero_recu }}</td>
                <td class="bold">{{ $p->reference_transaction }}</td>
                <td>{{ $p->member?->nom_complet ?? 'Ticket séance' }}</td>
                <td class="right">{{ Money::fcfa($p->montant_encaisse) }}</td>
                <td>{{ $p->cancellation ? 'ANNULÉ' : '' }}</td>
                <td style="width: 50px;"></td>
            </tr>
        @empty
            <tr><td colspan="7" class="muted">Aucun paiement.</td></tr>
        @endforelse
        </tbody>
        <tfoot>
        <tr>
            <th colspan="4">Total (hors annulés)</th>
            <th class="right">{{ Money::fcfa((int) $rows->filter(fn ($p) => ! $p->cancellation)->sum('montant_encaisse')) }}</th>
            <th colspan="2"></th>
        </tr>
        </tfoot>
    </table>
@endforeach
@endsection
