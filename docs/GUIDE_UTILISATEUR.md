# Guide utilisateur — GymManager

Guide court pour l'équipe de la salle. Une règle à retenir : **personne n'entre sans paiement
enregistré**. Pas de paiement = pas d'abonnement = QR refusé à la porte.

---

## Partie 1 — Réceptionniste

### Commencer la journée
1. Connectez-vous avec **votre** identifiant (ne prêtez jamais votre compte).
2. Menu **Caisse** → comptez les espèces du tiroir → saisissez le **fond de caisse** → *Ouvrir la caisse*.
   Sans caisse ouverte, aucune vente n'est possible.

### Inscrire un nouveau membre
1. **Accueil → + Nouveau membre**.
2. Prénom, nom, téléphone (ex. `77 123 45 67`) et **une photo** (prise avec la webcam ou le téléphone).
   La photo s'affiche à chaque entrée : sans photo, la carte peut être prêtée à quelqu'un d'autre.
3. Si le numéro existe déjà, l'application le signale et propose d'ouvrir la fiche existante.

### Vendre un abonnement (ou le renouveler)
1. **Vendre** (ou bouton *Renouveler* sur la fiche du membre).
2. Choisissez le membre, puis la formule : la période s'affiche (un renouvellement anticipé
   commence le lendemain de la fin de l'abonnement en cours, le membre ne perd aucun jour).
3. Choisissez le mode : **Espèces, Wave, Orange Money** ou Autre.
   Pour Wave et Orange Money, recopiez la **référence de la transaction** du SMS (obligatoire).
4. Vérifiez le récapitulatif → *Encaisser* → confirmez que vous avez bien reçu l'argent.
5. Imprimez le **reçu** (A5 ou ticket 80 mm) et, pour un premier abonnement, la **carte de membre** avec le QR.

**Réduction** : seul le patron peut l'accorder. Cliquez sur *Appliquer une réduction*, saisissez
le montant et le motif, puis le patron tape **son** identifiant et **son** mot de passe sur votre poste.

**Erreur de saisie ?** Un paiement ne se modifie jamais. Prévenez le patron : lui seul peut
l'annuler, avec un motif.

### Vendre une séance (ticket)
**Vendre une séance** → mode de paiement → *Encaisser*. Le ticket `T-XXXXXXXX` est valable
**aujourd'hui uniquement, pour une seule entrée**. Vous pouvez l'imprimer, l'afficher à l'écran
ou l'envoyer par WhatsApp.

### À la porte
Le poste de scan affiche :
- **VERT** : entrée acceptée — vérifiez que la **photo** correspond à la personne ;
- **ORANGE** : accepté, mais l'abonnement se termine dans 3 jours ou moins (proposez le renouvellement) ;
- **JAUNE** : déjà scanné il y a moins de 2 minutes (pas de nouvelle entrée comptée) ;
- **ROUGE** : refusé (abonnement expiré, suspendu, annulé, QR inconnu, ticket déjà utilisé…).
  La personne doit passer à l'accueil.

QR illisible (téléphone déchargé, carte abîmée) : sur la fiche du membre, *Entrée manuelle…*
avec un motif. L'abonnement est quand même vérifié, et le patron voit toutes les entrées manuelles.

### Dépenses
**Dépenses → + Nouvelle dépense** (montant, catégorie, description, photo du justificatif si possible).
Si vous payez avec l'argent de la caisse, cochez *Payée avec les espèces de ma caisse* : le montant
sera déduit à la clôture. La dépense attend la validation du patron.

### Fermer la caisse (fin de service)
1. **Caisse** → comptez **toutes** les espèces du tiroir → saisissez le total.
2. L'écran affiche l'écart avec le montant attendu. S'il n'est pas nul, expliquez-le (motif obligatoire).
3. *Clôturer et verrouiller* : la session ne peut plus être modifiée.
4. Les paiements Wave / Orange Money sont listés à part (*Liste Wave / OM*) pour comparaison avec le relevé.

Une caisse non fermée est signalée au patron le lendemain.

---

## Partie 2 — Patron (administrateur)

### Chaque jour
- **Tableau de bord** : recettes du jour et du mois, entrées, membres actifs, écarts de caisse,
  recettes des 30 derniers jours, heures d'affluence. L'encadré *À vérifier* liste ce qui demande
  votre attention.
- **Rapports → Rapport journalier → Hier** : combien a été encaissé, par qui, par quel mode, et
  combien de personnes sont entrées. Export **CSV** (Excel) ou **PDF**.

### Contrôles anti-fraude
- **Caisses** : toutes les clôtures et leurs écarts ; ajoutez un commentaire (les montants ne
  peuvent jamais être modifiés, même par vous).
- **Journal des accès** : chaque scan, y compris les refus et les QR inconnus.
- **Alertes** : caisses non clôturées, écarts, taux de refus anormal au scan, entrées manuelles,
  abonnements à relancer (avec lien WhatsApp).
- **Rapports → Annulations / Réductions / Entrées manuelles**.
- **Audit** : qui a fait quoi, quand, avec les valeurs avant et après.

### Actions réservées au patron
- **Annuler un paiement** (fiche du reçu ou du membre) : motif obligatoire ; l'abonnement est
  annulé et le QR refusé immédiatement. Le paiement d'origine reste visible.
- **Suspendre** un abonnement (blessure, voyage, impayé) et le **réactiver**, en prolongeant
  éventuellement la date de fin.
- **Carte perdue** : *Régénérer le QR* ; l'ancienne carte est refusée tout de suite.
- **Valider / rejeter** les dépenses.
- **Formules** : modifier les prix (les paiements passés gardent leur prix d'origine).
- **Utilisateurs** : créer un compte par employé, désactiver un compte (jamais de suppression).
- **Paramètres** : nom, logo, horaires, une seule entrée par jour, scan de sortie, seuil d'alerte.
- **Membres** : archiver, exporter ou anonymiser les données d'un membre.

### Bonnes pratiques
- Ne communiquez jamais votre mot de passe : il autorise les réductions.
- Vérifiez chaque matin les écarts de la veille et les caisses non clôturées.
- Comparez régulièrement la liste Wave / Orange Money avec le relevé de l'opérateur.
