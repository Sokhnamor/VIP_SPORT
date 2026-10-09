#!/usr/bin/env bash
# Démarrage du conteneur API : attente de MySQL, migrations, mise en cache de la configuration.
set -e

if [ "${GYM_ROLE:-app}" = "app" ]; then
  echo "Attente de la base de données…"
  for i in $(seq 1 60); do
    if php -r "try { new PDO('mysql:host=' . getenv('DB_HOST') . ';port=' . (getenv('DB_PORT') ?: 3306), getenv('DB_USERNAME'), getenv('DB_PASSWORD')); exit(0); } catch (Exception \$e) { exit(1); }"; then
      break
    fi
    sleep 2
  done

  php artisan migrate --force
  php artisan config:cache
  php artisan route:cache
  php artisan view:cache
fi

exec "$@"
