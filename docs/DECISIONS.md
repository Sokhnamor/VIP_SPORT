# Décisions techniques et hypothèses — GymManager

Ce document trace les choix faits pendant le développement, en particulier là où le cahier
des charges était ambigu. Règle appliquée en cas de doute : la règle d'or (« aucune entrée sans
paiement enregistré ») et l'option la plus restrictive côté sécurité.

## 1. Arborescence du projet

```
Sport_app/
├── backend/                      API Laravel 13 (JSON uniquement, /api/v1)
│   ├── app/
│   │   ├── Enums/                Rôles, modes de paiement, codes de scan, statuts…
│   │   ├── Exceptions/           BusinessRuleException (erreurs métier → 422)
│   │   ├── Http/
│   │   │   ├── Controllers/Api/V1/   Contrôleurs minces (aucune règle métier)
│   │   │   ├── Middleware/           Rôles, inactivité, changement de mot de passe, en-têtes
│   │   │   ├── Requests/             Form Requests (validation stricte)
│   │   │   └── Resources/            API Resources (forme des réponses)
│   │   ├── Models/
│   │   ├── Policies/
│   │   ├── Services/             PaymentService, SubscriptionService, AccessControlService,
│   │   │                         CashSessionService, ExpenseService, ReportService,
│   │   │                         AuditLogger, QrCodeService, ReceiptNumberGenerator, Settings…
│   │   └── Support/              Helpers (téléphone sénégalais, FCFA, dates Dakar, recherche)
│   ├── database/
│   │   ├── migrations/
│   │   ├── factories/
│   │   └── seeders/              Admin, formules, paramètres, démo (désactivable)
│   ├── resources/views/pdf/      Reçus, cartes membre, tickets, rapports (dompdf)
│   ├── routes/api.php
│   └── tests/Feature/            Scénarios d'acceptation §11 + permissions
├── frontend/                     SPA React + TypeScript (Vite, Tailwind)
│   ├── public/                   manifest.webmanifest, sw.js, icônes PWA
│   └── src/
│       ├── api/                  Client HTTP (cookies Sanctum + CSRF), hooks TanStack Query
│       ├── components/           UI réutilisable (boutons larges, champs, tableaux…)
│       ├── layouts/              Layout réception/admin, layout scan plein écran
│       ├── pages/                reception/, admin/, scan/, auth/
│       └── lib/                  Formatage FCFA / dates JJ/MM/AAAA / téléphones
├── docker/                       nginx, php (Dockerfile), scripts de sauvegarde
├── docker-compose.yml
├── docs/
│   ├── DECISIONS.md              (ce fichier)
│   ├── EXPLOITATION.md           sauvegarde, restauration, mise à jour, comptes
│   └── GUIDE_UTILISATEUR.md      guide court réceptionniste et patron
└── README.md
```

## 2. Migrations

| # | Table | Rôle |
|---|-------|------|
| 1 | `users` (+ `sessions`, `password_reset_tokens`) | Comptes : nom, identifiant, rôle, actif, doit_changer_mdp, derniere_connexion |
| 2 | `settings` | Paramètres clé/valeur (nom salle, horaires, options de scan…) |
| 3 | `plans` | Formules : nom, duree_jours, prix_fcfa, est_seance, actif |
| 4 | `members` | Membres : identité, téléphone unique, photo, qr_token unique (nullable avant 1er paiement), statut, colonne de recherche normalisée |
| 5 | `cash_sessions` | Sessions de caisse : fond, attendu, compté, écart, motif, commentaire admin, statut |
| 6 | `receipt_counters` | Compteur de reçus par année (verrouillé en transaction → numéros sans trou) |
| 7 | `payments` | Paiements immuables (+ triggers MySQL interdisant UPDATE/DELETE) |
| 8 | `payment_cancellations` | Annulations (1 max par paiement), motif obligatoire |
| 9 | `subscriptions` | Abonnements : période, statut stocké (actif/suspendu/annule), motifs |
| 10 | `tickets` | Tickets séance : numéro T-XXXXXXXX, qr_token, valable_le, statut |
| 11 | `access_logs` | Tous les scans (acceptés et refusés), entrées manuelles |
| 12 | `presences` | Présences (entree_at, sortie_at) |
| 13 | `expenses` | Dépenses, validation admin, justificatif |
| 14 | `audit_logs` | Journal d'audit (avant/après JSON, IP) |

## 3. Décisions

### Stack
- **Laravel 13** (dernière version stable disponible), PHP ≥ 8.3, MySQL 8 en production.
- Les tests automatisés tournent sur **SQLite en mémoire** (rapide, sans service externe).
  Les migrations restent portables ; les éléments propres à MySQL (triggers d'immuabilité)
  ne sont créés que si le driver est `mysql`. L'immuabilité est aussi garantie côté modèle.
- QR codes générés avec **bacon/bacon-qr-code** (moteur utilisé par simple-qrcode) en SVG :
  aucune dépendance à Imagick, et compatible avec Laravel 13 sans couche intermédiaire.
- Frontend : SPA servie **sur le même domaine** que l'API (proxy Vite en dev, nginx en prod).
  Cela simplifie l'authentification Sanctum par cookies et évite tout CORS ouvert ;
  CORS reste limité à `FRONTEND_URL`.

### Dates et fuseau
- Base en UTC, affichage en Africa/Dakar. Dakar est en UTC+0 sans heure d'été, mais tout le
  code passe quand même par `Dates::today()` / le fuseau `GYM_TIMEZONE` pour rester correct.
- `date_debut` et `date_fin` des abonnements sont des dates (sans heure) au sens de Dakar.

### Abonnements
- La colonne `statut` stocke `actif`, `suspendu` ou `annule`. Le statut affiché (`statut_effectif`)
  est calculé : `expire` si `date_fin` < aujourd'hui, `a_venir` si `date_debut` > aujourd'hui
  (renouvellement anticipé en attente). « a_venir » n'est pas dans le cahier des charges, mais est
  nécessaire pour afficher correctement un renouvellement anticipé.
- Un renouvellement anticipé s'enchaîne à la fin du **dernier** abonnement actif non expiré
  (y compris un abonnement déjà « à venir »).
- Le QR du membre (`qr_token`) n'est créé qu'au premier paiement d'abonnement, dans la même
  transaction (paiement + abonnement + QR). Un membre jamais payé n'a pas de QR.
- Formule « Séance unique » (`est_seance`) : vendue uniquement comme ticket, jamais comme abonnement.

### Paiements et réductions
- Le montant dû vient toujours de la formule côté serveur ; tout `montant_du` envoyé par le
  client est ignoré.
- `montant_encaisse` doit être égal à `montant_du − reduction` (pas de paiement partiel au MVP :
  un paiement partiel créerait un abonnement sans paiement complet, contraire à la règle d'or).
- Réduction : accordée par un admin connecté, **ou** par un réceptionniste si l'admin saisit
  sur le poste son identifiant et son mot de passe (« code d'autorisation »). Le serveur vérifie
  ces identifiants, enregistre l'admin dans `reduction_autorisee_par` et trace l'action dans l'audit.
- Tout paiement (y compris Wave/Orange Money) est rattaché à la session de caisse ouverte de
  l'encaisseur. Sans session ouverte : vente refusée (admin compris).
- Numéro de reçu `REC-AAAA-NNNNNN` : compteur par année verrouillé (`SELECT … FOR UPDATE`)
  dans la même transaction que le paiement. Si la transaction échoue, le compteur est annulé
  avec elle : aucun trou.
- Une annulation n'est possible qu'une fois par paiement.

### Contrôle d'accès
- Membre sans aucun abonnement : `REFUSE_EXPIRE` avec le message « Aucun abonnement payé ».
- Membre archivé ou jeton régénéré : `REFUSE_INCONNU`.
- Ticket : un second scan est toujours `TICKET_UTILISE` (même dans les 2 minutes), conformément
  au scénario §11.8 et à la règle « la plus restrictive ».
- Option `une_entree_par_jour` : code supplémentaire `REFUSE_QUOTA_JOUR` (rouge, « déjà entré
  aujourd'hui »). Le code `DEJA_SCANNE` (< 2 min) reste prioritaire.
- Mode sortie : on ne refuse jamais une sortie pour motif d'abonnement ; le jeton doit seulement
  être reconnu. La présence ouverte la plus récente est clôturée.
- Rate limiting du scan : 60 scans/minute par appareil (compte + IP) au total et
  **10 jetons inconnus/minute** par appareil ; au-delà → HTTP 429.

### Caisse
- Espèces attendues = fond initial + paiements espèces non annulés de la session −
  dépenses espèces payées depuis la caisse (statut `en_attente` ou `validee`).
- Une dépense peut être marquée « payée depuis la caisse » seulement si son auteur a une
  session ouverte ; elle y est alors rattachée.

### Sécurité / sessions
- Session Laravel de 12 h maximum ; un middleware impose 30 min d'inactivité pour admin et
  réceptionniste, et 12 h pour le compte scanner.
- Compte admin initial : `doit_changer_mdp = true` ; toute route autre que « changer mon mot de
  passe », « moi » et « déconnexion » renvoie 403 tant que le mot de passe n'est pas changé.
- Mot de passe fort : 10 caractères minimum, majuscules, minuscules, chiffres
  (et vérification contre les fuites connues en production).

### Rapports
- **Recettes nettes d'une période = Σ paiements créés dans la période − Σ montants des paiements
  annulés dans la période** (l'annulation compte à la date où elle est faite). Une période passée
  ne change donc jamais après coup ; une annulation tardive apparaît le jour de l'annulation.
  Cette définition unique est utilisée par le tableau de bord, les rapports et les exports (§11.14).
- **Taux de renouvellement** : parmi les abonnements non annulés arrivés à échéance dans la période,
  part des membres ayant un abonnement ultérieur qui commence au plus tard 30 jours après la fin.
- Les agrégations par jour et par heure sont faites en PHP dans le fuseau de la salle (portable
  MySQL / SQLite, exact quel que soit le fuseau).
- Exports CSV : séparateur `;` et BOM UTF-8, pour une ouverture directe dans Excel en français.

### Membres et données personnelles
- Archivage, anonymisation, export et régénération du QR : **admin uniquement** (option la plus
  restrictive ; le réceptionniste « crée et modifie »).
- L'anonymisation efface identité, contact, photo et QR, mais conserve l'historique financier
  et des accès (obligation de traçabilité des encaissements).
- Chaque consultation de fiche membre et chaque export sont journalisés dans l'audit.
- Les photos sont servies uniquement via une **URL signée valable 60 min** (le poste de scan peut
  afficher la photo du membre scanné sans avoir accès aux fiches ni pouvoir énumérer les photos).
- Recherche : correspondance sans accents ni casse sur nom, prénom et téléphone ; à défaut,
  recherche approchée (distance de Levenshtein ≤ 1 ou 2 selon la longueur du mot).

### QR et tickets
- Jeton encodé en base32 majuscule (32 caractères, 160 bits) : saisissable à la main sans
  ambiguïté de casse. Le code complet est imprimé sous le QR de la carte membre.
- Le ticket a un **numéro court** `T-XXXXXXXX` (8 caractères, ~40 bits) accepté en saisie
  manuelle au poste de scan ; la force brute est empêchée par la limite de 10 codes inconnus
  par minute et par appareil. Le message WhatsApp contient ce numéro (wa.me ne permet pas
  d'envoyer une image ; aucune page publique du QR n'est exposée).

### Divers
- Paiement partiel : non pris en charge (le montant encaissé doit égaler montant dû − réduction).
- Entrée manuelle : soumise aux mêmes règles que le scan (un abonnement invalide reste refusé).
- Mode hors ligne du poste de scan : hors MVP. Le service worker ne met en cache que l'interface,
  jamais l'API ; en cas de coupure, l'écran l'indique clairement et aucun scan n'est décidé.
  Structure prévue pour plus tard : une file locale de scans « à confirmer », rejouée et
  décidée par le serveur au retour du réseau (aucune décision prise côté appareil).
- Le front n'applique aucune règle métier : il affiche les montants, périodes et décisions
  renvoyés par l'API ; l'écart de caisse affiché avant clôture n'est qu'un aperçu, recalculé
  et enregistré par le serveur.
- Graphiques : une série par graphique (pas de légende), couleur de la palette catégorielle
  validée (bleu, pas distinct en mode sombre), vue tableau toujours disponible.
- PDF : sous-ensemble de police embarqué (un reçu pèse ~20 Ko au lieu de ~860 Ko).
- Docker : un seul `.env` à la racine pour Compose ; MySQL lancé avec
  `--log-bin-trust-function-creators=1` pour autoriser les triggers d'immuabilité.
