# Étape 1 : construction de la SPA React
FROM node:24-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Étape 2 : nginx sert la SPA et relaie /api vers PHP-FPM (même origine : cookies Sanctum sans CORS)
FROM nginx:1.27-alpine
COPY docker/web/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# index.php de Laravel doit exister côté nginx pour le try_files de /api
RUN mkdir -p /var/www/backend/public && touch /var/www/backend/public/index.php
