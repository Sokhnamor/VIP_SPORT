<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;

/**
 * Sauvegarde de la base : mysqldump compressé (MySQL) ou copie du fichier (SQLite),
 * dans storage/app/backups (ou BACKUP_PATH), avec rotation. Restauration : docs/EXPLOITATION.md.
 */
#[Signature('gym:sauvegarde {--keep=30 : Nombre de jours de sauvegardes conservées}')]
#[Description('Sauvegarde la base de données (rotation automatique)')]
class BackupDatabase extends Command
{
    public function handle(): int
    {
        $dir = config('gym.backup_path');
        File::ensureDirectoryExists($dir);

        $connection = config('database.default');
        $config = config("database.connections.{$connection}");
        $stamp = now()->format('Y-m-d_His');

        if ($config['driver'] === 'sqlite') {
            $target = "{$dir}/gym-{$stamp}.sqlite";
            File::copy($config['database'], $target);
        } elseif (in_array($config['driver'], ['mysql', 'mariadb'], true)) {
            $target = "{$dir}/gym-{$stamp}.sql.gz";
            // --single-transaction : sauvegarde cohérente sans bloquer les ventes en cours.
            // --triggers : les triggers d'immuabilité font partie de la sauvegarde.
            $process = Process::fromShellCommandline(
                'mysqldump --single-transaction --routines --triggers --no-tablespaces '
                .'-h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$DB_NAME" | gzip > "$TARGET"',
                null,
                [
                    'DB_HOST' => $config['host'],
                    'DB_PORT' => (string) $config['port'],
                    'DB_USER' => $config['username'],
                    'DB_NAME' => $config['database'],
                    'MYSQL_PWD' => (string) $config['password'],
                    'TARGET' => $target,
                ],
                null,
                600,
            );
            $process->run();

            if (! $process->isSuccessful() || filesize($target) < 100) {
                $this->error('Échec de la sauvegarde : '.$process->getErrorOutput());
                File::delete($target);

                return self::FAILURE;
            }
        } else {
            $this->error("Driver {$config['driver']} non pris en charge.");

            return self::FAILURE;
        }

        $this->rotate($dir, (int) $this->option('keep'));
        $this->info("Sauvegarde créée : {$target}");

        return self::SUCCESS;
    }

    private function rotate(string $dir, int $keepDays): void
    {
        $limit = now()->subDays($keepDays)->getTimestamp();
        foreach (File::files($dir) as $file) {
            if (str_starts_with($file->getFilename(), 'gym-') && $file->getMTime() < $limit) {
                File::delete($file->getPathname());
            }
        }
    }
}
