<?php

use Illuminate\Support\Facades\Route;

// Le backend ne sert que l'API (/api/v1) ; l'interface est la SPA du dossier frontend/.
Route::get('/', fn () => response()->json(['application' => config('app.name'), 'api' => '/api/v1']));
