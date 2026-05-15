#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# Установка и настройка host-level Nginx + Let's Encrypt
# для ecoprogress.kz
#
# Запуск:  sudo bash setup-nginx.sh
# ──────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NGINX_HOST_DIR="$SCRIPT_DIR/nginx-host"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[+]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[✗]${NC} $*"; exit 1; }

[[ $EUID -eq 0 ]] || err "Запускай от root:  sudo bash $0"

# ─── 1. Установка Nginx + Certbot ────────────────────────────
log "Обновление пакетов..."
apt-get update -qq

if ! command -v nginx &>/dev/null; then
    log "Установка Nginx..."
    apt-get install -y -qq nginx
else
    log "Nginx уже установлен"
fi

if ! command -v certbot &>/dev/null; then
    log "Установка Certbot..."
    apt-get install -y -qq certbot python3-certbot-nginx
else
    log "Certbot уже установлен"
fi

# ─── 2. Создание директорий ──────────────────────────────────
mkdir -p /var/www/certbot
mkdir -p /etc/nginx/snippets

# ─── 3. Копирование snippets ─────────────────────────────────
log "Копирование snippets..."
cp "$NGINX_HOST_DIR/snippets/ssl-params.conf"   /etc/nginx/snippets/ssl-params.conf
cp "$NGINX_HOST_DIR/snippets/proxy-params.conf" /etc/nginx/snippets/proxy-params.conf

# ─── 4. Временный HTTP-only конфиг для получения сертификата ──
log "Создание временного HTTP конфига для ecoprogress.kz..."
cat > /etc/nginx/sites-available/ecoprogress.conf <<'HTTPCONF'
server {
    listen 80;
    listen [::]:80;
    server_name ecoprogress.kz www.ecoprogress.kz;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'Certbot validation in progress...';
        add_header Content-Type text/plain;
    }
}
HTTPCONF

ln -sf /etc/nginx/sites-available/ecoprogress.conf /etc/nginx/sites-enabled/ecoprogress.conf

if [ -L /etc/nginx/sites-enabled/default ]; then
    rm /etc/nginx/sites-enabled/default
    log "Удалён default virtual host"
fi

nginx -t && systemctl reload nginx
log "Nginx перезагружен с временным конфигом"

# ─── 5. Получение SSL-сертификата ────────────────────────────
read -rp "$(echo -e "${YELLOW}Email для Let's Encrypt (для уведомлений о продлении): ${NC}")" LE_EMAIL

if [ ! -d /etc/letsencrypt/live/ecoprogress.kz ]; then
    log "Запрос сертификата для ecoprogress.kz..."
    certbot certonly \
        --webroot \
        --webroot-path /var/www/certbot \
        -d ecoprogress.kz \
        -d www.ecoprogress.kz \
        --email "$LE_EMAIL" \
        --agree-tos \
        --non-interactive
else
    warn "Сертификат для ecoprogress.kz уже существует, пропускаем"
fi

# ─── 6. Установка полного конфига с HTTPS ─────────────────────
log "Установка production конфига ecoprogress.kz..."
cp "$NGINX_HOST_DIR/ecoprogress.conf" /etc/nginx/sites-available/ecoprogress.conf

nginx -t && systemctl reload nginx
log "Nginx перезагружен с HTTPS конфигом"

# ─── 7. Автоматическое продление сертификатов ─────────────────
if ! crontab -l 2>/dev/null | grep -q certbot; then
    log "Добавление cron для автопродления сертификатов..."
    (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -
fi

# ─── 8. Открытие портов в файрволе ───────────────────────────
if command -v ufw &>/dev/null; then
    log "Настройка UFW..."
    ufw allow 'Nginx Full' >/dev/null 2>&1 || true
fi

# ─── Готово ───────────────────────────────────────────────────
echo ""
log "========================================="
log "  Настройка завершена!"
log "========================================="
echo ""
echo "  https://ecoprogress.kz"
echo ""
echo "  Проверить конфиг:    sudo nginx -t"
echo "  Перезагрузить:       sudo systemctl reload nginx"
echo "  Статус сертификатов: sudo certbot certificates"
echo "  Логи nginx:          tail -f /var/log/nginx/ecoprogress.*.log"
echo ""
