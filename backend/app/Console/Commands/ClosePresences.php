<?php

namespace App\Console\Commands;

use App\Services\AccessControlService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('gym:cloturer-presences')]
#[Description('Clôture les présences encore ouvertes après l\'heure de fermeture')]
class ClosePresences extends Command
{
    public function handle(AccessControlService $access): int
    {
        $count = $access->closeOpenPresences();
        $this->info("{$count} présence(s) clôturée(s).");

        return self::SUCCESS;
    }
}
