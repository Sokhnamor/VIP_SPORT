<?php

namespace App\Enums;

/**
 * Codes de décision du contrôle d'accès (cahier des charges §4.5).
 * REFUSE_QUOTA_JOUR est ajouté pour l'option « une entrée par jour » (voir DECISIONS.md).
 */
enum ScanResult: string
{
    case Accepte = 'ACCEPTE';
    case AccepteAlerte = 'ACCEPTE_ALERTE';
    case RefuseExpire = 'REFUSE_EXPIRE';
    case RefuseSuspendu = 'REFUSE_SUSPENDU';
    case RefuseAnnule = 'REFUSE_ANNULE';
    case RefuseInconnu = 'REFUSE_INCONNU';
    case RefuseQuotaJour = 'REFUSE_QUOTA_JOUR';
    case TicketUtilise = 'TICKET_UTILISE';
    case TicketExpire = 'TICKET_EXPIRE';
    case DejaScanne = 'DEJA_SCANNE';

    public function isAccepted(): bool
    {
        return $this === self::Accepte || $this === self::AccepteAlerte;
    }

    /** Couleur affichée par le poste de scan. */
    public function color(): string
    {
        return match ($this) {
            self::Accepte => 'vert',
            self::AccepteAlerte => 'orange',
            self::DejaScanne => 'jaune',
            default => 'rouge',
        };
    }
}
