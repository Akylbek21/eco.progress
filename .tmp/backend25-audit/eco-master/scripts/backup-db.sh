#!/usr/bin/env bash
# Дамп MySQL из compose-стека eco с отправкой отчёта на почту.
#
# Запускать с сервера, из каталога проекта (там же, где docker-compose.yml и .env):
#     ./scripts/backup-db.sh
#
# Секреты берутся только из .env (он в .gitignore) - в репозитории их быть не должно.
# Нужны: MYSQL_ROOT_PASSWORD (уже есть), плюс блок SMTP_* / MAIL_TO (см. .env.example).
#
# Почему root, а не eco: mysqldump сохраняет схему целиком, включая объекты, на которые у
# прикладного пользователя может не быть прав. --no-tablespaces снимает требование привилегии
# PROCESS, иначе на MySQL 8 дамп падает.
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE=".env"
[ -f "$ENV_FILE" ] || { echo "Нет $ENV_FILE рядом с docker-compose.yml" >&2; exit 1; }
set -a; . "$ENV_FILE"; set +a

# Параметры почты держатся в git (deploy/backup-mail.env), а не в .env - осознанное решение,
# чтобы бэкап настраивался выкаткой кода без ручной правки .env на сервере. Подробности и
# предупреждения - в шапке самого файла. Читается вторым, поэтому переопределяет .env.
MAIL_ENV="deploy/backup-mail.env"
if [ -f "$MAIL_ENV" ]; then
    set -a; . "$MAIL_ENV"; set +a
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
# Gmail режет письма больше 25 МБ вместе со служебным обвесом; 20 - запас на base64 (+33%).
MAX_ATTACH_MB="${BACKUP_MAX_ATTACH_MB:-20}"
DB_NAME="${MYSQL_DATABASE:-eco}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DUMP="$BACKUP_DIR/eco-$STAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date -Is)] dump -> $DUMP"
# -T обязателен: без него docker выделяет псевдо-TTY, дамп приезжает с \r\n, и восстановление
# потом молча ломается на многострочных значениях.
docker compose exec -T mysql \
    mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" \
        --single-transaction --routines --triggers --events \
        --no-tablespaces --default-character-set=utf8mb4 \
        "$DB_NAME" \
    | gzip -9 > "$DUMP"

# Проверка результата: mysqldump стоит в начале конвейера, поэтому его падение не роняет
# скрипт целиком. Без явной проверки пустой или оборванный дамп уехал бы в бэкап как успешный
# и обнаружился бы только в момент восстановления.
STATUS="OK"
SIZE_BYTES=$(stat -c%s "$DUMP")
if [ "$SIZE_BYTES" -lt 1024 ]; then
    echo "Дамп подозрительно мал ($SIZE_BYTES Б) - считаем неудачей" >&2
    STATUS="ОШИБКА"
elif ! gzip -t "$DUMP" 2>/dev/null; then
    echo "Архив повреждён" >&2
    STATUS="ОШИБКА"
fi

SIZE_H=$(du -h "$DUMP" | cut -f1)
TABLES=$(zcat "$DUMP" 2>/dev/null | grep -c "^CREATE TABLE" || true)

find "$BACKUP_DIR" -name 'eco-*.sql.gz' -mtime +"$KEEP_DAYS" -delete

SUBJECT="[eco] Бэкап БД $STATUS - $STAMP ($SIZE_H)"
BODY="Сервер:   $(hostname)
Каталог:  $(pwd)/$BACKUP_DIR
Файл:     $(basename "$DUMP")
Размер:   $SIZE_H
Таблиц:   $TABLES
Статус:   $STATUS
Хранение: $KEEP_DAYS дней"

SIZE_MB=$(( SIZE_BYTES / 1024 / 1024 ))
if [ "$SIZE_MB" -le "$MAX_ATTACH_MB" ] && [ "$STATUS" = "OK" ]; then
    ATTACH="$DUMP"
else
    ATTACH=""
    BODY="$BODY

Файл не вложен (${SIZE_MB} МБ > ${MAX_ATTACH_MB} МБ либо дамп неуспешен) - заберите его с сервера."
fi

SUBJECT="$SUBJECT" BODY="$BODY" ATTACH="$ATTACH" python3 "$(dirname "$0")/send-mail.py"
echo "[$(date -Is)] готово: $STATUS"
