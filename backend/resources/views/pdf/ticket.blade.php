@extends('pdf.layout')
@section('title', 'Ticket '.$ticket->numero)
@section('font-size', '10px')

@push('styles')
<style>@page { margin: 10px; }</style>
@endpush

@section('content')
<div class="center">
    <h1>{{ $gym['nom_salle'] }}</h1>
    <div class="bold" style="font-size: 13px; margin: 6px 0;">TICKET SÉANCE</div>
    <img src="{{ $qr }}" style="width: 170px;"><br>
    <div class="bold" style="font-size: 16px; margin-top: 4px;">{{ $ticket->numero }}</div>
    <div style="margin-top: 6px;">Valable le <span class="bold">{{ $ticket->valable_le->format('d/m/Y') }}</span> uniquement</div>
    <div class="small muted" style="margin-top: 4px;">Usage unique — expire à minuit</div>
</div>
@endsection
