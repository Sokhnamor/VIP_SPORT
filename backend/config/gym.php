<?php

return [
    // Fuseau de la salle : toutes les notions de « jour » en dépendent.
    'timezone' => env('GYM_TIMEZONE', 'Africa/Dakar'),

    // Délai pendant lequel un re-scan du même QR ne crée pas de nouvelle entrée.
    'rescan_window_seconds' => 120,

    // Seuil (jours) de l'alerte orange au scan.
    'scan_alert_days' => 3,

    // Limites de débit du poste de scan (par compte + IP).
    'scan_rate_per_minute' => (int) env('SCAN_RATE_PER_MINUTE', 60),
    'scan_unknown_per_minute' => (int) env('SCAN_UNKNOWN_PER_MINUTE', 10),

    // Dossier des sauvegardes quotidiennes (commande gym:sauvegarde).
    'backup_path' => env('BACKUP_PATH', storage_path('app/backups')),

    // Données initiales (seeders).
    'seed' => [
        'admin_identifiant' => env('ADMIN_IDENTIFIANT', 'admin'),
        'admin_password' => env('ADMIN_PASSWORD'),
        'nom_salle' => env('GYM_NOM'),
        'demo' => (bool) env('SEED_DEMO', false),
    ],

    // Taille maximale des photos et justificatifs (Ko).
    'max_upload_kb' => 5120,

    // Valeurs par défaut des paramètres modifiables par l'admin (table settings).
    'defaults' => [
        'nom_salle' => 'GymManager',
        'adresse' => 'Almadies 2, Dakar',
        'telephone' => '',
        'logo_path' => null,
        'heure_ouverture' => '06:00',
        'heure_fermeture' => '22:00',
        'une_entree_par_jour' => false,
        'mode_sortie' => false,
        'seuil_alerte_expiration' => 7,
    ],
];
