# Image PHP-FPM de l'API Laravel (utilisée aussi par le planificateur).
FROM php:8.4-fpm-alpine

RUN apk add --no-cache \
        icu-dev libzip-dev libpng-dev libjpeg-turbo-dev freetype-dev libwebp-dev \
        mysql-client gzip bash tzdata \
    && docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql intl zip gd bcmath opcache exif \
    && cp /usr/share/zoneinfo/UTC /etc/localtime

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY docker/php/php.ini /usr/local/etc/php/conf.d/gym.ini

WORKDIR /var/www/backend

# Dépendances d'abord (cache Docker), puis le code.
COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --no-interaction --prefer-dist

COPY backend/ ./
RUN composer dump-autoload --optimize --no-dev \
    && mkdir -p storage/framework/{cache,sessions,views} storage/logs storage/app/private storage/app/backups bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

COPY docker/php/entrypoint.sh /usr/local/bin/gym-entrypoint
RUN chmod +x /usr/local/bin/gym-entrypoint

ENTRYPOINT ["gym-entrypoint"]
CMD ["php-fpm"]
