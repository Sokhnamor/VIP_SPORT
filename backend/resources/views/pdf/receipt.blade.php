@php
    use App\Support\Dates;
    use App\Support\Money;
    use App\Support\Phone;
    $narrow = $format === '80mm';
@endphp
@extends('pdf.layout')
@section('title', 'Reçu '.$payment->numero_recu)
@section('font-size', $narrow ? '9px' : '11px')

@push('styles')
<style>
    @page { margin: {{ $narrow ? '8px' : '28px' }}; }
    .amount { font-size: {{ $narrow ? '14px' : '20px' }}; font-weight: bold; }
    td.label { color: #555; width: {{ $narrow ? '42%' : '35%' }}; }
</style>
@endpush

@section('content')
<div class="center">
    @if($gym['logo'] && ! $narrow)
        <img src="{{ $gym['logo'] }}" style="max-height: 50px;"><br>
    @endif
    <h1>{{ $gym['nom_salle'] }}</h1>
    <div class="muted">{{ $gym['adresse'] }}@if($gym['telephone']) — {{ $gym['telephone'] }}@endif</div>
</div>
<hr>
<div class="center">
    <div class="bold" style="font-size: {{ $narrow ? '11px' : '14px' }};">REÇU N° {{ $payment->numero_recu }}</div>
    <div class="muted">{{ Dates::displayDateTime($payment->created_at) }}</div>
    @if($payment->cancellation)
        <div style="margin-top:6px;"><span class="stamp">ANNULÉ le {{ Dates::displayDateTime($payment->cancellation->created_at) }}</span></div>
    @endif
</div>
<hr>
<table>
    <tr><td class="label">Membre</td><td>{{ $payment->member?->nom_complet ?? 'Client séance' }}</td></tr>
    @if($payment->member)
        <tr><td class="label">Téléphone</td><td>{{ Phone::display($payment->member->telephone) }}</td></tr>
    @endif
    <tr><td class="label">Formule</td><td>{{ $payment->plan->nom }}</td></tr>
    @if($payment->subscription)
        <tr><td class="label">Période</td><td>du {{ $payment->subscription->date_debut->format('d/m/Y') }} au {{ $payment->subscription->date_fin->format('d/m/Y') }}</td></tr>
    @endif
    @if($payment->ticket)
        <tr><td class="label">Ticket</td><td>{{ $payment->ticket->numero }} — valable le {{ $payment->ticket->valable_le->format('d/m/Y') }} uniquement</td></tr>
    @endif
    <tr><td class="label">Montant dû</td><td>{{ Money::fcfa($payment->montant_du) }}</td></tr>
    @if($payment->reduction > 0)
        <tr><td class="label">Réduction</td><td>− {{ Money::fcfa($payment->reduction) }} ({{ $payment->motif_reduction }})</td></tr>
    @endif
    <tr><td class="label">Mode</td><td>{{ $payment->mode->label() }}@if($payment->reference_transaction) — réf. {{ $payment->reference_transaction }}@endif</td></tr>
    <tr><td class="label">Encaissé par</td><td>{{ $payment->user->nom }}</td></tr>
</table>
<hr>
<table>
    <tr>
        <td class="bold">MONTANT PAYÉ</td>
        <td class="right amount">{{ Money::fcfa($payment->montant_encaisse) }}</td>
    </tr>
</table>
@if($ticketQr)
    <hr>
    <div class="center">
        <img src="{{ $ticketQr }}" style="width: {{ $narrow ? '120px' : '150px' }};"><br>
        <span class="bold">{{ $payment->ticket->numero }}</span><br>
        <span class="small muted">Usage unique — valable le {{ $payment->ticket->valable_le->format('d/m/Y') }}</span>
    </div>
@endif
<hr>
<div class="center small muted">Merci de votre confiance. Conservez ce reçu.</div>
@endsection
