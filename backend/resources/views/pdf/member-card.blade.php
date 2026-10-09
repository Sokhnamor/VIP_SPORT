@extends('pdf.layout')
@section('title', 'Carte membre')
@section('font-size', '8px')

@push('styles')
<style>
    @page { margin: 6px; }
    .card { width: 100%; }
    .photo { width: 62px; height: 78px; object-fit: cover; border: 1px solid #999; }
    .nophoto { width: 62px; height: 78px; border: 1px solid #999; background: #eee; }
    .name { font-size: 11px; font-weight: bold; }
    .gym { font-size: 10px; font-weight: bold; color: #0b5; }
    .code { font-size: 5.5px; letter-spacing: 0.2px; word-break: break-all; }
</style>
@endpush

@section('content')
<table class="card">
    <tr>
        <td colspan="3" class="gym">{{ $gym['nom_salle'] }} <span class="muted small" style="font-weight: normal;">— carte de membre</span></td>
    </tr>
    <tr>
        <td style="width: 66px;">
            @if($photo)
                <img src="{{ $photo }}" class="photo">
            @else
                <div class="nophoto"></div>
            @endif
        </td>
        <td>
            <div class="name">{{ $member->prenom }}<br>{{ strtoupper($member->nom) }}</div>
            <div class="muted" style="margin-top: 4px;">Membre n° {{ str_pad((string) $member->id, 5, '0', STR_PAD_LEFT) }}</div>
            <div class="muted">Inscrit le {{ $member->date_inscription->format('d/m/Y') }}</div>
            <div class="small muted" style="margin-top: 6px;">Carte personnelle — la photo est vérifiée à chaque entrée.</div>
        </td>
        <td style="width: 84px;" class="center">
            <img src="{{ $qr }}" style="width: 82px;">
        </td>
    </tr>
    <tr>
        <td colspan="3" class="code muted center">{{ $member->qr_token }}</td>
    </tr>
</table>
@endsection
