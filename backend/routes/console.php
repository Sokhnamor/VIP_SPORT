<?php

use Illuminate\Support\Facades\Schedule;

// Clôture automatique des présences encore ouvertes (après l'heure de fermeture configurée).
Schedule::command('gym:cloturer-presences')->everyFifteenMinutes()->withoutOverlapping();

// Sauvegarde quotidienne de la base (voir docs/EXPLOITATION.md).
Schedule::command('gym:sauvegarde')->dailyAt('02:30')->timezone(config('gym.timezone'))->withoutOverlapping();
