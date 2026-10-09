@php use App\Support\Dates; @endphp
@extends('pdf.layout')
@section('title', $table['titre'])
@section('font-size', '9px')

@push('styles')
<style>@page { margin: 24px; }</style>
@endpush

@section('content')
<table>
    <tr>
        <td><h1>{{ $gym['nom_salle'] }}</h1><div class="muted">{{ $gym['adresse'] }}</div></td>
        <td class="right muted small">Édité le {{ Dates::displayDateTime(now()) }}</td>
    </tr>
</table>
<h2>{{ $table['titre'] }}</h2>
<table class="grid">
    <thead>
    <tr>
        @foreach($table['colonnes'] as $col)
            <th>{{ $col }}</th>
        @endforeach
    </tr>
    </thead>
    <tbody>
    @forelse($table['lignes'] as $ligne)
        <tr>
            @foreach($ligne as $cell)
                <td @if(is_int($cell)) class="right" @endif>{{ is_int($cell) ? number_format($cell, 0, ',', ' ') : $cell }}</td>
            @endforeach
        </tr>
    @empty
        <tr><td colspan="{{ count($table['colonnes']) }}" class="muted">Aucune donnée sur la période.</td></tr>
    @endforelse
    </tbody>
    @if(! empty($table['totaux']))
        <tfoot>
        <tr>
            @foreach($table['totaux'] as $cell)
                <th @if(is_int($cell)) class="right" @endif>{{ is_int($cell) ? number_format($cell, 0, ',', ' ') : $cell }}</th>
            @endforeach
        </tr>
        </tfoot>
    @endif
</table>
@endsection
