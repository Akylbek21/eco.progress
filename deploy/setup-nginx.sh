#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# Установка и настройка host-level Nginx + Let's Encrypt
# для ecoprogress.kz и db.ecoprogress.kz
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

# ─── 4. Email для Let's Encrypt ───────────────────────────────
read -rp "$(echo -e "${YELLOW}Email для Let's Encrypt: ${NC}")" LE_EMAIL

# ─── 5. Настройка ecoprogress.kz ─────────────────────────────
setup_domain() {
    local DOMAIN="$1"
    local CONF_FILE="$2"
    local EXTRA_DOMAINS="${3:-}"

    log "Настройка $DOMAIN..."

    # Временный HTTP конфиг
    cat > "/etc/nginx/sites-available/${CONF_FILE}" <<HTTPCONF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} ${EXTRA_DOMAINS};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'Certbot validation in progress...';
        add_header Content-Type text/plain;
    }
}
HTTPCONF

    ln -sf "/etc/nginx/sites-available/${CONF_FILE}" "/etc/nginx/sites-enabled/${CONF_FILE}"

    if [ -L /etc/nginx/sites-enabled/default ]; then
        rm /etc/nginx/sites-enabled/default
    fi

    nginx -t && systemctl reload nginx

    # SSL-сертификат
    if [ ! -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
        log "Запрос сертификата для ${DOMAIN}..."
        local CERTBOT_ARGS="-d ${DOMAIN}"
        if [ -n "$EXTRA_DOMAINS" ]; then
            for d in $EXTRA_DOMAINS; do
                CERTBOT_ARGS="$CERTBOT_ARGS -d $d"
            done
        fi
        certbot certonly \
            --webroot \
            --webroot-path /var/www/certbot \
            $CERTBOT_ARGS \
            --email "$LE_EMAIL" \
            --agree-tos \
            --non-interactive
    else
        warn "Сертификат для ${DOMAIN} уже существует, пропускаем"
    fi

    # Production конфиг
    log "Установка production конфига ${DOMAIN}..."
    cp "$NGINX_HOST_DIR/${CONF_FILE}" "/etc/nginx/sites-available/${CONF_FILE}"
    nginx -t && systemctl reload nginx
    log "${DOMAIN} готов"
}

setup_domain "ecoprogress.kz" "ecoprogress.conf" "www.ecoprogress.kz"
setup_domain "db.ecoprogress.kz" "db.ecoprogress.conf" ""

# ─── 6. Автоматическое продление сертификатов ─────────────────
if ! crontab -l 2>/dev/null | grep -q certbot; then
    log "Добавление cron для автопродления сертификатов..."
    (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -
fi

# ─── 7. Открытие портов в файрволе ───────────────────────────
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
echo "  https://ecoprogress.kz       — сайт"
echo "  https://db.ecoprogress.kz    — phpMyAdmin"
echo ""
echo "  Проверить конфиг:    sudo nginx -t"
echo "  Перезагрузить:       sudo systemctl reload nginx"
echo "  Статус сертификатов: sudo certbot certificates"
echo ""
