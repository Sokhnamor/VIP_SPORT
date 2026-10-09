/** Types des réponses de l'API (miroir des API Resources Laravel). */

export type Role = 'admin' | 'receptionniste' | 'scanner'

export type User = {
  id: number
  nom: string
  identifiant: string
  role: Role
  role_libelle: string
  actif: boolean
  doit_changer_mdp: boolean
  derniere_connexion: string | null
}

export type Plan = {
  id: number
  nom: string
  duree_jours: number
  prix_fcfa: number
  est_seance: boolean
  actif: boolean
}

export type Subscription = {
  id: number
  member_id: number
  plan?: Plan
  plan_id: number
  payment_id: number
  date_debut: string
  date_fin: string
  date_fin_initiale: string
  statut: 'actif' | 'expire' | 'suspendu' | 'annule' | 'a_venir'
  statut_libelle: string
  suspendu_motif: string | null
  suspendu_at: string | null
  annule_at: string | null
  created_at: string
}

export type Member = {
  id: number
  nom: string
  prenom: string
  nom_complet: string
  telephone: string
  telephone_affiche: string
  email: string | null
  date_naissance: string | null
  sexe: 'M' | 'F' | null
  contact_urgence: string | null
  notes: string | null
  date_inscription: string
  statut: 'actif' | 'archive'
  anonymise: boolean
  photo_url: string | null
  a_un_qr: boolean
  abonnement_en_cours: Subscription | null
  couvert_jusqu_au: string | null
  created_at: string
}

export type Ticket = {
  id: number
  numero: string
  payment_id: number
  member_id: number | null
  valable_le: string
  statut: 'valide' | 'utilise' | 'annule' | 'expire'
  statut_libelle: string
  utilise_at: string | null
  qr_url: string
  pdf_url: string
}

export type Payment = {
  id: number
  numero_recu: string
  member?: { id: number; nom_complet: string; telephone: string } | null
  member_id: number | null
  plan?: { id: number; nom: string; est_seance: boolean }
  montant_du: number
  reduction: number
  motif_reduction: string | null
  reduction_autorisee_par?: string | null
  montant_encaisse: number
  mode: string
  mode_libelle: string
  reference_transaction: string | null
  encaisseur?: { id: number; nom: string }
  cash_session_id: number
  created_at: string
  annule: boolean | null
  annulation?: { motif: string; par: string | null; created_at: string } | null
  abonnement?: Subscription | null
  ticket?: Ticket | null
}

export type CashTotals = {
  fond_initial: number
  especes: number
  wave: number
  orange_money: number
  autre: number
  nombre_paiements: number
  nombre_annulations: number
  depenses_especes: number
  especes_attendues: number
}

export type CashSession = {
  id: number
  employe?: { id: number; nom: string }
  user_id: number
  ouverte_at: string
  fermee_at: string | null
  fond_initial: number
  especes_attendues: number | null
  especes_comptees: number | null
  ecart: number | null
  motif_ecart: string | null
  statut: 'ouverte' | 'cloturee'
  commentaire_admin: string | null
  commente_par?: string | null
  commente_at: string | null
  oubli_cloture: boolean
  totaux: CashTotals | null
}

export type Expense = {
  id: number
  date_depense: string
  categorie: string
  categorie_libelle: string
  montant: number
  description: string
  mode: string
  mode_libelle: string
  a_justificatif: boolean
  justificatif_url: string | null
  statut: 'en_attente' | 'validee' | 'rejetee' | 'annulee'
  statut_libelle: string
  auteur?: string
  payee_depuis_caisse: boolean
  cash_session_id: number | null
  decide_par?: string | null
  decide_at: string | null
  motif_decision: string | null
  created_at: string
}

export type AccessLog = {
  id: number
  resultat: string
  couleur: string
  type: 'entree' | 'sortie'
  manuel: boolean
  motif_manuel: string | null
  member?: { id: number; nom_complet: string } | null
  ticket?: string | null
  operateur?: string
  scanned_at: string
  ip: string | null
}

export type AuditLog = {
  id: number
  action: string
  utilisateur?: string | null
  user_id: number | null
  entite: string | null
  entite_id: number | null
  avant: Record<string, unknown> | null
  apres: Record<string, unknown> | null
  ip: string | null
  created_at: string
}

export type ScanResult = {
  resultat: string
  couleur: 'vert' | 'orange' | 'jaune' | 'rouge'
  accepte: boolean
  message: string
  type: 'entree' | 'sortie'
  membre: { id: number; nom_complet: string; photo_url: string | null } | null
  ticket: { numero: string } | null
  date_fin: string | null
  jours_restants: number | null
  scanned_at: string | null
}

export type Settings = {
  nom_salle: string
  adresse: string | null
  telephone: string | null
  logo_url: string | null
  heure_ouverture: string
  heure_fermeture: string
  une_entree_par_jour: boolean
  mode_sortie: boolean
  seuil_alerte_expiration: number
}

export type Paginated<T> = {
  data: T[]
  meta?: { current_page: number; last_page: number; total: number; per_page: number }
  links?: unknown
}

export type Revenue = { brut: number; annulations: number; net: number; nombre_paiements: number; nombre_annulations: number }

export type Breakdown = { cle: string; libelle: string; nombre: number; brut: number; annulations: number; net: number }
