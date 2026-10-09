# GymManager

Application web de gestion d'une salle de sport (Dakar, Almadies 2) : membres, abonnements,
paiements, caisse, contrôle d'accès par QR code, dépenses, tableau de bord et rapports.

**Règle d'or : aucune entrée sans paiement enregistré.** Pas de paiement = pas d'abonnement
actif = pas de QR valide = pas d'accès. Toutes les règles sont appliquées par le serveur.

| Dossier | Contenu |
|---|---|
| `backend/` | API REST Laravel 13 (`/api/v1`), MySQL, tests |
| `frontend/` | SPA React + TypeScript (Vite, Tailwind), PWA du poste de scan |
| `docker/`, `docker-compose.yml` | Environnement complet (PHP-FPM, nginx, MySQL, planificateur, Mailpit) |
| `docs/DECISIONS.md` | Décisions techniques et hypothèses |
| `docs/EXPLOITATION.md` | Sauvegarde, restauration, mise à jour, comptes |
| `docs/GUIDE_UTILISATEUR.md` | Guide court réceptionniste et patron |

## Démarrage rapide avec Docker (recommandé)

Prérequis : Docker Desktop ou Docker Engine + Compose v2.

```bash
cp .env.example .env
# Éditer .env : APP_KEY, DB_PASSWORD, DB_ROOT_PASSWORD, APP_URL, SANCTUM_STATEFUL_DOMAINS…
# Générer une clé : docker compose run --rm --no-deps app php -r "echo 'base64:'.base64_encode(random_bytes(32)).PHP_EOL;"
docker compose up -d --build
docker compose exec app php artisan db:seed --force     # admin initial, formules, paramètres
```

- Interface : <http://localhost:8080> (port `WEB_PORT`)
- Mailpit (e-mails de test) : <http://localhost:8025>
- Compte initial : identifiant `admin` (`ADMIN_IDENTIFIANT`), mot de passe `ADMIN_PASSWORD`
  ou, s'il est vide, un mot de passe provisoire affiché par le seeder. **Il doit être changé à
  la première connexion** (l'application l'impose).
- Jeu de démonstration (45 jours d'activité fictive) : `SEED_DEMO=true` avant le seeding —
  comptes `awa`, `modou` (réception) et `scan-porte` (scanner), mot de passe `Demo-Gym-2026`.
  **Jamais en production.**

> **HTTPS obligatoire en production** : les navigateurs n'autorisent la caméra (poste de scan)
> qu'en HTTPS (ou sur `localhost`). Placez un terminateur TLS (Caddy, Traefik, certbot + nginx)
> devant le conteneur `web`, puis mettez `SESSION_SECURE_COOKIE=true`. Voir `docs/EXPLOITATION.md`.

## Développement local (sans Docker)

Prérequis : PHP ≥ 8.3 (extensions pdo_mysql ou pdo_sqlite, intl, gd, zip, bcmath), Composer 2,
Node.js ≥ 20, MySQL 8 (ou SQLite pour essayer).

```bash
# API
cd backend
composer install
cp .env.example .env          # adapter DB_* (ou DB_CONNECTION=sqlite)
php artisan key:generate
php artisan migrate --seed    # SEED_DEMO=true php artisan migrate:fresh --seed pour la démo
php artisan serve --port=8000

# Interface (autre terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173, relaie /api vers http://127.0.0.1:8000
```

Si le port 8000 est pris : `php artisan serve --port=8010` puis
`VITE_BACKEND_URL=http://127.0.0.1:8010 npm run dev -- --port 5180`, et ajoutez `localhost:5180`
à `SANCTUM_STATEFUL_DOMAINS`.

Tâches planifiées (clôture des présences, sauvegarde) : `php artisan schedule:work` en développement,
une entrée cron `* * * * * php /chemin/backend/artisan schedule:run` en production.

## Variables d'environnement principales (`backend/.env`)

| Variable | Rôle |
|---|---|
| `APP_URL`, `FRONTEND_URL` | URL publique ; CORS limité à `FRONTEND_URL` |
| `SANCTUM_STATEFUL_DOMAINS` | Hôtes (avec port) autorisés à utiliser l'authentification par cookies |
| `SESSION_LIFETIME` | Durée max. de session (12 h) ; l'inactivité est limitée à 30 min (admin, réception) |
| `SESSION_SECURE_COOKIE` | `true` en HTTPS |
| `GYM_TIMEZONE` | Fuseau de la salle (`Africa/Dakar`) — base en UTC |
| `SCAN_RATE_PER_MINUTE`, `SCAN_UNKNOWN_PER_MINUTE` | Limites du poste de scan (60 scans, 10 QR inconnus / min) |
| `BACKUP_PATH` | Dossier des sauvegardes quotidiennes |
| `ADMIN_IDENTIFIANT`, `ADMIN_PASSWORD`, `GYM_NOM`, `SEED_DEMO` | Données initiales |
| `TRUSTED_PROXIES` | Adresse du reverse proxy (pour l'IP réelle dans l'audit) |

## Commandes utiles

```bash
cd backend
php artisan test                       # suite de tests (SQLite en mémoire)
DB_CONNECTION=mysql DB_HOST=… DB_DATABASE=… php artisan test   # même suite sur MySQL (triggers compris)
vendor/bin/pint                        # style de code
vendor/bin/phpstan analyse             # analyse statique (niveau 5)
php artisan gym:sauvegarde             # sauvegarde immédiate de la base
php artisan gym:cloturer-presences     # clôture manuelle des présences ouvertes

cd frontend
npm run build                          # vérification TypeScript + build de production
npm run lint
```

## Tests

`backend/tests/Feature` couvre les 14 scénarios d'acceptation du cahier des charges (§11), tous
les codes de scan (§4.5) et les permissions par rôle : 137 tests. Ils tournent sur SQLite en
mémoire et passent aussi sur MySQL 8.4 (le test des triggers d'immuabilité ne s'exécute que sur
MySQL).

## Architecture en bref

- **Logique métier dans des services** (`backend/app/Services`) : `PaymentService` (vente atomique
  paiement + abonnement/ticket + QR, réductions, annulations), `SubscriptionService`,
  `AccessControlService` (décision de scan), `CashSessionService`, `ExpenseService`,
  `ReportService`, `AlertService`, `AuditLogger`. Les contrôleurs sont minces.
- **Droits** : middleware de rôle par groupe de routes + policies par objet. Le front ne fait
  aucun contrôle décisif : toute requête non autorisée reçoit 403 du serveur.
- **Immuabilité** : paiements, annulations, journal des accès et audit sont en ajout seul
  (modèles Eloquent + triggers MySQL). Une session de caisse clôturée est verrouillée.
- **Numéros de reçu sans trou** : compteur annuel verrouillé dans la transaction du paiement.
- **QR** : jeton opaque aléatoire de 160 bits (`M-…` membre, `T-…` ticket), aucune donnée
  personnelle ; toute la validation est côté serveur, avec limitation de débit.

Le déploiement, les sauvegardes et la restauration sont décrits dans `docs/EXPLOITATION.md`.
