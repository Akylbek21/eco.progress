#!/usr/bin/env bash
#
# Пост-деплойный smoke test прав ПЭК для роли ADMIN (ТЗ, п.8).
#
# Проверяет то, что было сломано: /api/auth/me не возвращал permissions, из-за чего
# фронтенд показывал раздел ПЭК, но блокировал создание и редактирование
# ("Нет доступа. У вас нет права для выполнения этого действия в ПЭК").
#
# По умолчанию НИЧЕГО НЕ СОЗДАЁТ в проде. Права на запись проверяются пробой:
# если у ADMIN нет права, эндпоинт отвечает 403 - это и есть баг. Любой другой ответ
# (400/404/409) означает, что проверка прав пройдена и запрос ушёл дальше, в валидацию.
# Настоящее создание программы и отчёта включается флагом --with-writes.
#
# Использование:
#   ADMIN_PASSWORD=... ./scripts/pek-admin-smoke.sh https://ecoprogress.kz admin@ecoprogress.kz
#   ADMIN_PASSWORD=... ./scripts/pek-admin-smoke.sh --with-writes --company-id 1 --object-id 1 \
#       https://ecoprogress.kz admin@ecoprogress.kz
#
# Пароль передаётся только через переменную окружения ADMIN_PASSWORD или интерактивный
# ввод - не аргументом, чтобы не оседал в history и в выводе ps.

set -uo pipefail

WITH_WRITES=0
COMPANY_ID=""
OBJECT_ID=""
ARGS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --with-writes) WITH_WRITES=1; shift ;;
    --company-id)  COMPANY_ID="${2:-}"; shift 2 ;;
    --object-id)   OBJECT_ID="${2:-}"; shift 2 ;;
    -h|--help)     sed -n '2,26p' "$0"; exit 0 ;;
    *)             ARGS+=("$1"); shift ;;
  esac
done

BASE_URL="${ARGS[0]:-}"
ADMIN_EMAIL="${ARGS[1]:-}"

if [ -z "$BASE_URL" ] || [ -z "$ADMIN_EMAIL" ]; then
  echo "Usage: ADMIN_PASSWORD=... $0 [--with-writes --company-id N --object-id N] <base-url> <admin-email>" >&2
  exit 2
fi
BASE_URL="${BASE_URL%/}"

if [ -z "${ADMIN_PASSWORD:-}" ]; then
  read -r -s -p "Пароль для $ADMIN_EMAIL: " ADMIN_PASSWORD
  echo
fi

# Первый "id" верхнего уровня. Жадный sed здесь не годится: он вернул бы ПОСЛЕДНИЙ "id" в
# ответе, а у программы/отчёта есть вложенные объекты со своими id.
extract_first_id() {
  grep -o '"id"[[:space:]]*:[[:space:]]*[0-9]\+' | head -1 | grep -o '[0-9]\+$'
}

PASS=0
FAIL=0
ok()   { echo "  OK    $1"; PASS=$((PASS+1)); }
bad()  { echo "  FAIL  $1"; FAIL=$((FAIL+1)); }
step() { echo; echo "-- $1"; }

# Все обязательные для ADMIN права из ТЗ, п.4.
REQUIRED_PERMISSIONS="
PEK_VIEW PEK_PROGRAM_VIEW PEK_PROGRAM_CREATE PEK_PROGRAM_EDIT PEK_PROGRAM_SUBMIT
PEK_PROGRAM_APPROVE PEK_PROGRAM_ACTIVATE PEK_PROGRAM_ARCHIVE PEK_REPORT_VIEW
PEK_REPORT_CREATE PEK_REPORT_EDIT PEK_REPORT_COLLECT PEK_REPORT_MATCH PEK_REPORT_VALIDATE
PEK_REPORT_REVIEW PEK_REPORT_RETURN PEK_REPORT_APPROVE PEK_REPORT_SIGN PEK_REPORT_SUBMIT
PEK_REPORT_EXPORT PEK_SETTINGS_EDIT PEK_ADMIN
"

# --------------------------------------------------------------------------------------
step "1/6  Вход под ADMIN (POST /api/auth/staff/login) — эквивалент «выйти и войти заново»"

LOGIN_BODY=$(printf '{"email":"%s","password":"%s"}' "$ADMIN_EMAIL" "$ADMIN_PASSWORD")
LOGIN_RESPONSE=$(curl -sS -X POST "$BASE_URL/api/auth/staff/login" \
  -H 'Content-Type: application/json' -d "$LOGIN_BODY" 2>&1)

TOKEN=$(printf '%s' "$LOGIN_RESPONSE" | sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
if [ -z "$TOKEN" ]; then
  bad "вход не удался — ответ: $(printf '%s' "$LOGIN_RESPONSE" | head -c 400)"
  echo; echo "Итог: провал на входе, дальнейшие проверки пропущены."; exit 1
fi
ok "получен JWT"

AUTH=(-H "Authorization: Bearer $TOKEN")

# --------------------------------------------------------------------------------------
step "2/6  GET /api/auth/me содержит permissions (собственно исправление)"

ME=$(curl -sS "${AUTH[@]}" "$BASE_URL/api/auth/me")

if ! printf '%s' "$ME" | grep -q '"permissions"'; then
  bad "поле permissions отсутствует — на сервере старая сборка"
  echo "      ответ: $(printf '%s' "$ME" | head -c 400)"
else
  ok "поле permissions присутствует"
  MISSING=""
  for perm in $REQUIRED_PERMISSIONS; do
    printf '%s' "$ME" | grep -q "\"$perm\"" || MISSING="$MISSING $perm"
  done
  if [ -n "$MISSING" ]; then
    bad "у ADMIN нет прав:$MISSING"
  else
    ok "все 22 обязательных права ПЭК на месте"
  fi
fi

# --------------------------------------------------------------------------------------
# 403 = права нет (тот самый баг). Любой другой код = гейт прав пройден.
probe() {
  local label="$1" method="$2" path="$3" body="${4:-}"
  local code
  if [ -n "$body" ]; then
    code=$(curl -sS -o /dev/null -w '%{http_code}' -X "$method" "$BASE_URL$path" \
      "${AUTH[@]}" -H 'Content-Type: application/json' -d "$body")
  else
    code=$(curl -sS -o /dev/null -w '%{http_code}' -X "$method" "$BASE_URL$path" "${AUTH[@]}")
  fi
  case "$code" in
    403) bad "$label — HTTP 403, права нет" ;;
    401) bad "$label — HTTP 401, токен не принят" ;;
    5*)  bad "$label — HTTP $code, ошибка сервера" ;;
    *)   ok  "$label — HTTP $code, проверка прав пройдена" ;;
  esac
}

step "3/6  Открытие раздела ПЭК"
probe "GET  /api/pek/programs" GET "/api/pek/programs"

step "4/6  Создание программы (проба прав, без записи данных)"
probe "POST /api/pek/programs" POST "/api/pek/programs" '{}'

step "5/6  Создание отчёта (проба прав, без записи данных)"
probe "POST /api/pek/reports" POST "/api/pek/reports" '{}'

step "6/6  Настройки ПЭК"
probe "GET  /api/pek/settings" GET "/api/pek/settings"

# --------------------------------------------------------------------------------------
if [ "$WITH_WRITES" = "1" ]; then
  step "Дополнительно: реальное создание (--with-writes)"
  if [ -z "$COMPANY_ID" ] || [ -z "$OBJECT_ID" ]; then
    bad "--with-writes требует --company-id и --object-id"
  else
    echo "  ВНИМАНИЕ: в базе будут созданы реальные записи. Удалите их после проверки."
    YEAR=$(date +%Y)

    PROGRAM=$(curl -sS -X POST "$BASE_URL/api/pek/programs" "${AUTH[@]}" \
      -H 'Content-Type: application/json' \
      -d "$(printf '{"companyId":%s,"objectId":%s,"name":"SMOKE TEST — удалить"}' \
            "$COMPANY_ID" "$OBJECT_ID")")
    PROGRAM_ID=$(printf '%s' "$PROGRAM" | extract_first_id)
    if [ -n "$PROGRAM_ID" ]; then
      ok "программа создана, id=$PROGRAM_ID (удалите её)"
    else
      bad "программа не создана: $(printf '%s' "$PROGRAM" | head -c 300)"
    fi

    REPORT=$(curl -sS -X POST "$BASE_URL/api/pek/reports" "${AUTH[@]}" \
      -H 'Content-Type: application/json' \
      -d "$(printf '{"companyId":%s,"objectId":%s,"periodType":"QUARTER","year":%s,"quarter":1}' \
            "$COMPANY_ID" "$OBJECT_ID" "$YEAR")")
    REPORT_ID=$(printf '%s' "$REPORT" | extract_first_id)
    if [ -n "$REPORT_ID" ]; then
      ok "отчёт создан, id=$REPORT_ID (удалите его)"
    else
      bad "отчёт не создан: $(printf '%s' "$REPORT" | head -c 300)"
    fi
  fi
fi

# --------------------------------------------------------------------------------------
echo
echo "======================================"
echo "  Пройдено: $PASS    Провалено: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ] || exit 1
