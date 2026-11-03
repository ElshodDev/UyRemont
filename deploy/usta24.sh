#!/usr/bin/env bash
# =============================================
# Usta24 serverini boshqarish (Ubuntu/Debian, Docker)
#   ./usta24.sh install          - birinchi o'rnatish: sozlamalar, HTTPS, ishga tushirish
#   ./usta24.sh update           - yangi versiyani olish (git pull) va qayta ishga tushirish
#   ./usta24.sh restart          - deploy/.env o'zgargandan keyin qayta ishga tushirish
#   ./usta24.sh status           - xizmatlar holati, oxirgi zaxira, disk
#   ./usta24.sh logs [xizmat]    - loglar (backend, web, db, backup)
#   ./usta24.sh backup           - hozir zaxira olish
#   ./usta24.sh backups          - zaxiralar ro'yxati
#   ./usta24.sh restore DB_FAYL [FAYLLAR_ARXIVI] - zaxiradan tiklash
#   ./usta24.sh stop             - to'xtatish
# =============================================
set -euo pipefail
cd "$(dirname "$0")"

GREEN=$'\e[32m'; YELLOW=$'\e[33m'; RED=$'\e[31m'; BOLD=$'\e[1m'; RESET=$'\e[0m'
info() { echo "${GREEN}✔${RESET} $*"; }
warn() { echo "${YELLOW}⚠${RESET} $*"; }
fail() { echo "${RED}✖ $*${RESET}" >&2; exit 1; }

compose() { docker compose "$@"; }

# deploy/.env dagi qiymat (bo'sh bo'lsa - bo'sh qator)
env_get() { [ -f .env ] && grep -E "^$1=" .env | tail -1 | cut -d= -f2- || true; }

random_secret() {
    openssl rand -hex "${1:-32}" 2>/dev/null || head -c "${1:-32}" /dev/urandom | od -An -tx1 | tr -d ' \n'
}

ask() {
    local prompt="$1" default="${2:-}" answer
    read -r -p "$prompt${default:+ [$default]}: " answer || true
    echo "${answer:-$default}"
}

ask_secret() {
    local prompt="$1" answer
    read -r -s -p "$prompt: " answer || true
    echo >&2
    echo "$answer"
}

confirm() {
    local answer
    read -r -p "$1 [ha/yo'q]: " answer || true
    [[ "$answer" =~ ^(ha|h|yes|y)$ ]]
}

need_docker() {
    if ! command -v docker >/dev/null 2>&1; then
        warn "Docker o'rnatilmagan."
        [ "$(id -u)" -eq 0 ] || fail "Docker'ni o'rnatish uchun: sudo ./usta24.sh install"
        if confirm "Docker rasmiy skript bilan o'rnatilsinmi (get.docker.com)?"; then
            curl -fsSL https://get.docker.com | sh
        else
            fail "Docker kerak: https://docs.docker.com/engine/install/"
        fi
    fi
    docker compose version >/dev/null 2>&1 || fail "docker compose topilmadi (Docker 20.10+ va compose plagini kerak)"
    docker info >/dev/null 2>&1 || fail "Docker ishlamayapti yoki ruxsat yo'q. sudo bilan ishga tushiring"
}

wait_healthy() {
    local service="$1" seconds="${2:-180}" id status
    for ((i = 0; i < seconds; i += 3)); do
        id="$(compose ps -q "$service" 2>/dev/null || true)"
        status="$( [ -n "$id" ] && docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || echo starting)"
        [ "$status" = "healthy" ] && return 0
        sleep 3
    done
    return 1
}

write_env() {
    local domain admin_phone login eskiz_email="" eskiz_password="" telegram_token="" support_phone support_telegram payment_info
    echo
    echo "${BOLD}Usta24 sozlamalari${RESET} (keyin deploy/.env faylida o'zgartirish mumkin)"
    echo

    while true; do
        domain="$(ask "Sayt domeni (masalan usta24.uz)")"
        domain="${domain#https://}"; domain="${domain#http://}"; domain="${domain%/}"
        domain="$(echo "$domain" | tr '[:upper:]' '[:lower:]')"
        [[ "$domain" =~ ^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$ ]] && break
        warn "Domen noto'g'ri. Masalan: usta24.uz yoki app.usta24.uz"
    done

    while true; do
        admin_phone="$(ask "Administrator telefon raqami" "+998")"
        admin_phone="$(echo "$admin_phone" | tr -d ' ()-')"
        [[ "$admin_phone" =~ ^\+998[0-9]{9}$ ]] && break
        warn "Raqam +998XXXXXXXXX ko'rinishida bo'lsin"
    done

    echo
    echo "Kirish kodi qanday yuboriladi?"
    echo "  1) Eskiz SMS"
    echo "  2) Telegram bot"
    echo "  3) Ikkalasi"
    echo "  4) Keyinroq sozlayman (unda hech kim tizimga kira olmaydi)"
    login="$(ask "Tanlang" "2")"
    if [[ "$login" == "1" || "$login" == "3" ]]; then
        eskiz_email="$(ask "Eskiz email")"
        eskiz_password="$(ask_secret "Eskiz parol")"
    fi
    if [[ "$login" == "2" || "$login" == "3" ]]; then
        while true; do
            telegram_token="$(ask "Telegram bot tokeni (@BotFather -> /newbot)")"
            [[ -z "$telegram_token" || "$telegram_token" =~ ^[0-9]+:[A-Za-z0-9_-]{30,}$ ]] && break
            warn "Token formati noto'g'ri (masalan 123456789:AA...)"
        done
    fi

    echo
    support_phone="$(ask "Yordam telefoni (ixtiyoriy, masalan +998 71 200 00 00)")"
    support_telegram="$(ask "Yordam Telegram username (ixtiyoriy, @ siz)")"
    support_telegram="${support_telegram#@}"
    payment_info="$(ask "Ustalar komissiyani qayerga to'laydi (karta raqami va egasi, ixtiyoriy)")"

    umask 077
    cat > .env <<EOF
# Usta24 production sozlamalari ($(date +%Y-%m-%d) da ./usta24.sh install yaratdi)
# Bu faylni hech kimga bermang. O'zgartirgandan keyin: ./usta24.sh restart
# Barcha sozlamalar tavsifi: env.example

DOMAIN=$domain
PUBLIC_APP_URL=https://$domain

POSTGRES_PASSWORD=$(random_secret 24)
JWT_SECRET=$(random_secret 32)
DATA_ENCRYPTION_KEY=$(random_secret 32)

ADMIN_PHONE=$admin_phone
ADMIN_NAME=Administrator
ADMIN_REQUIRE_2FA=true

OTP_DEV_MODE=false
ESKIZ_EMAIL=$eskiz_email
ESKIZ_PASSWORD=$eskiz_password
ESKIZ_FROM=4546
TELEGRAM_BOT_TOKEN=$telegram_token

SUPPORT_PHONE=$support_phone
SUPPORT_TELEGRAM=$support_telegram

PLATFORM_COMMISSION_PERCENT=10
CATALOG_COMMISSION_PERCENT=10
PRICE_ENTRY_HOURS=24
REFERRAL_MASTER_BONUS=20000
REFERRAL_WELCOME_BONUS=20000
REFERRAL_CLIENT_BONUS=5000
REFERRAL_MIN_LABOR=50000
COMMISSION_DEBT_LIMIT=200000
COMMISSION_PAYMENT_INFO=$payment_info
DISPATCH_REQUIRE_ADMIN_APPROVAL=false

BACKUP_HOUR=3
BACKUP_KEEP_DAYS=14
BACKUP_KEEP_WEEKS=8
EOF
    chmod 600 .env
    info "deploy/.env yaratildi (maxfiy kalitlar avtomatik)"
}

check_dns() {
    local domain="$1" resolved public
    resolved="$(getent ahostsv4 "$domain" 2>/dev/null | awk 'NR == 1 { print $1 }' || true)"
    public="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
    if [ -z "$resolved" ]; then
        warn "$domain DNS'da topilmadi. Domen panelida A yozuvi qo'shing: $domain -> ${public:-serverning IP manzili}"
        warn "DNS ishlamaguncha HTTPS sertifikati olinmaydi (Caddy o'zi qayta urinadi)."
    elif [ -n "$public" ] && [ "$resolved" != "$public" ]; then
        warn "$domain -> $resolved, lekin bu serverning IP manzili $public. DNS A yozuvini tekshiring."
    else
        info "DNS: $domain -> $resolved"
    fi
}

open_firewall() {
    if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
        if confirm "Firewall (ufw) yoqilgan. 80 va 443 portlar ochilsinmi?"; then
            ufw allow 80/tcp >/dev/null && ufw allow 443/tcp >/dev/null && ufw allow 443/udp >/dev/null
            info "80 va 443 portlar ochildi"
        fi
    fi
}

cmd_install() {
    need_docker
    if [ -f .env ]; then
        info "deploy/.env allaqachon bor - sozlamalar va kalitlar o'zgartirilmaydi"
    else
        write_env
    fi
    local domain; domain="$(env_get DOMAIN)"
    [ -n "$domain" ] || fail "deploy/.env da DOMAIN yo'q"
    mkdir -p backups && chmod 700 backups
    check_dns "$domain"
    open_firewall

    echo
    info "Imijlar yig'ilmoqda va ishga tushirilmoqda (birinchi marta 3-5 daqiqa)..."
    compose up -d --build
    if wait_healthy backend 240; then
        info "Backend ishlayapti"
    else
        compose logs --tail=50 backend
        fail "Backend ishga tushmadi. Loglar: ./usta24.sh logs backend"
    fi

    echo
    echo "${BOLD}Tayyor!${RESET} Sayt: ${BOLD}https://$domain${RESET}"
    echo "  - HTTPS sertifikati bir necha daqiqada olinadi (DNS to'g'ri bo'lsa)."
    echo "  - Administrator: $(env_get ADMIN_PHONE) raqami bilan kiring, keyin ikki bosqichli himoyani yoqing."
    echo "  - Zaxira har kuni soat $(env_get BACKUP_HOUR):00 da: deploy/backups/ (./usta24.sh backups)"
    echo "  - Zaxiralarni boshqa joyga ham ko'chirib turing (masalan, kompyuteringizga: scp)."
    if [ -z "$(env_get ESKIZ_EMAIL)" ] && [ -z "$(env_get TELEGRAM_BOT_TOKEN)" ]; then
        warn "SMS ham, Telegram bot ham sozlanmagan: hech kim kira olmaydi. deploy/.env ni to'ldirib, ./usta24.sh restart"
    fi
}

cmd_update() {
    need_docker
    if [ -d ../.git ]; then
        info "Yangi versiya olinmoqda (git pull)..."
        git -C .. pull --ff-only
    fi
    compose up -d --build --remove-orphans
    wait_healthy backend 240 && info "Yangilandi va ishlayapti" || fail "Backend ishga tushmadi: ./usta24.sh logs backend"
    docker image prune -f >/dev/null 2>&1 || true
}

cmd_restart() {
    compose up -d --remove-orphans
    wait_healthy backend 180 && info "Qayta ishga tushdi" || fail "Backend ishga tushmadi: ./usta24.sh logs backend"
}

cmd_status() {
    compose ps --format 'table {{.Service}}\t{{.Status}}'
    echo
    if [ -f backups/.last-success ]; then
        info "Oxirgi zaxira: $(TZ=Asia/Tashkent date -d "@$(cat backups/.last-success)" '+%Y-%m-%d %H:%M' 2>/dev/null || cat backups/.last-success)"
    else
        warn "Hali zaxira olinmagan"
    fi
    df -h / | awk 'NR == 2 { print "Disk: " $3 " band, " $4 " bo'\''sh (" $5 ")" }'
}

cmd_backup() {
    compose exec -T backup /bin/sh /usr/local/bin/backup.sh now
}

cmd_backups() {
    echo "${BOLD}Kunlik:${RESET}"
    ls -lh backups/ 2>/dev/null | grep -E 'db-|files-' || echo "  (yo'q)"
    echo "${BOLD}Haftalik:${RESET}"
    ls -lh backups/weekly/ 2>/dev/null | grep -E 'db-|files-' || echo "  (yo'q)"
}

cmd_restore() {
    local db_file="${1:-}" files_file="${2:-}"
    [ -n "$db_file" ] || fail "Foydalanish: ./usta24.sh restore db-YYYY-MM-DD_HHMMSS.dump [files-YYYY-MM-DD_HHMMSS.tar.gz]"
    db_file="$(basename "$db_file")"
    [ -f "backups/$db_file" ] || [ -f "backups/weekly/$db_file" ] || fail "backups/ ichida $db_file topilmadi (./usta24.sh backups)"
    [ -f "backups/$db_file" ] || cp "backups/weekly/$db_file" "backups/$db_file"
    if [ -n "$files_file" ]; then
        files_file="$(basename "$files_file")"
        [ -f "backups/$files_file" ] || [ -f "backups/weekly/$files_file" ] || fail "backups/ ichida $files_file topilmadi"
        [ -f "backups/$files_file" ] || cp "backups/weekly/$files_file" "backups/$files_file"
    fi

    warn "Hozirgi baza $db_file holatiga qaytariladi. Undan keyingi barcha o'zgarishlar yo'qoladi."
    confirm "Davom etilsinmi?" || fail "Bekor qilindi"

    info "Avval hozirgi holatning zaxirasi olinadi (tiklash kutilganidek bo'lmasa, unga qaytish mumkin)..."
    cmd_backup
    info "Backend to'xtatilmoqda..."
    compose stop backend
    if compose exec -T backup /bin/sh /usr/local/bin/backup.sh restore "$db_file" "$files_file"; then
        compose start backend
        wait_healthy backend 180 && info "Tiklandi va ishlayapti" || fail "Backend ishga tushmadi: ./usta24.sh logs backend"
    else
        compose start backend
        fail "Tiklashda xato. Backend qayta ishga tushirildi; yuqoridagi xabarni tekshiring"
    fi
}

cmd_logs() {
    compose logs -f --tail=200 "$@"
}

cmd_stop() {
    compose stop
}

case "${1:-}" in
    install) cmd_install ;;
    update) cmd_update ;;
    restart) cmd_restart ;;
    status) cmd_status ;;
    logs) shift; cmd_logs "$@" ;;
    backup) cmd_backup ;;
    backups) cmd_backups ;;
    restore) shift; cmd_restore "$@" ;;
    stop) cmd_stop ;;
    *)
        sed -n '3,12p' "$0" | sed 's/^# \{0,1\}//'
        exit 1
        ;;
esac
