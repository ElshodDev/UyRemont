#!/bin/sh
# =============================================
# Usta24 - zaxira nusxalar (docker-compose'dagi "backup" xizmati ichida ishlaydi)
#   schedule        - har kuni BACKUP_HOUR da (Toshkent vaqti) zaxira; birinchi ishga tushishda darhol
#   now             - hozir zaxira olish
#   check           - oxirgi muvaffaqiyatli zaxira 26 soatdan eski bo'lmasa 0 (healthcheck)
#   restore DB [FILES] - bazani (va fayllarni) zaxiradan tiklash (backend to'xtatilgan bo'lishi kerak)
# Fayllar: /backups/db-YYYY-MM-DD_HHMMSS.dump (pg_dump), /backups/files-YYYY-MM-DD_HHMMSS.tar.gz (rasmlar, hujjatlar)
# Yakshanba kungi nusxa /backups/weekly/ ga ham qo'yiladi va uzoqroq saqlanadi.
# =============================================
set -eu
umask 077

BACKUP_DIR=/backups
DATA_DIR=/data
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
KEEP_WEEKS="${BACKUP_KEEP_WEEKS:-8}"
HOUR="${BACKUP_HOUR:-3}"
LAST_SUCCESS="$BACKUP_DIR/.last-success"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

run_backup() {
    mkdir -p "$BACKUP_DIR/weekly"
    stamp="$(date +%Y-%m-%d_%H%M%S)"
    # Mavjud nusxa hech qachon ustidan yozilmaydi (masalan, tiklashdan oldingi nusxa bir soniyada olinsa)
    n=1
    while [ -e "$BACKUP_DIR/db-$stamp.dump" ] || [ -e "$BACKUP_DIR/files-$stamp.tar.gz" ]; do
        n=$((n + 1))
        stamp="$(date +%Y-%m-%d_%H%M%S)-$n"
    done
    db_file="$BACKUP_DIR/db-$stamp.dump"
    files_file="$BACKUP_DIR/files-$stamp.tar.gz"

    log "Zaxira boshlandi: $stamp"
    # Avval vaqtinchalik nomga yoziladi: yarim yozilgan fayl zaxira bo'lib ko'rinmasin
    pg_dump --format=custom --no-owner --no-acl --file="$db_file.tmp"
    # Fayl haqiqatan tiklanadigan ekanini tekshirish
    pg_restore --list "$db_file.tmp" > /dev/null
    mv "$db_file.tmp" "$db_file"

    tar -czf "$files_file.tmp" -C "$DATA_DIR" .
    mv "$files_file.tmp" "$files_file"

    # Yakshanba: haftalik nusxa, kuniga bittadan (qattiq havola - qo'shimcha joy egallamaydi)
    if [ "$(date +%u)" = "7" ] && ! ls "$BACKUP_DIR/weekly/db-$(date +%Y-%m-%d)_"* > /dev/null 2>&1; then
        ln -f "$db_file" "$BACKUP_DIR/weekly/" 2>/dev/null || cp "$db_file" "$BACKUP_DIR/weekly/"
        ln -f "$files_file" "$BACKUP_DIR/weekly/" 2>/dev/null || cp "$files_file" "$BACKUP_DIR/weekly/"
    fi

    # Eski nusxalarni o'chirish
    find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'db-*.dump' -o -name 'files-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete
    find "$BACKUP_DIR/weekly" -maxdepth 1 -type f -mtime +"$((KEEP_WEEKS * 7))" -delete
    find "$BACKUP_DIR" -maxdepth 1 -name '*.tmp' -mmin +120 -delete

    date +%s > "$LAST_SUCCESS"
    date +%F > "$BACKUP_DIR/.last-date"
    log "Tayyor: $(basename "$db_file") ($(du -h "$db_file" | cut -f1)), $(basename "$files_file") ($(du -h "$files_file" | cut -f1))"
}

case "${1:-schedule}" in
    now)
        run_backup
        ;;
    schedule)
        log "Har kuni soat $HOUR:00 da zaxira olinadi; kunlik nusxalar $KEEP_DAYS kun, haftaliklar $KEEP_WEEKS hafta saqlanadi"
        # Birinchi ishga tushish: backend jadvallarni yaratgach darhol bitta zaxira (healthcheck uchun ham)
        if [ ! -f "$LAST_SUCCESS" ]; then
            tries=0
            until [ "$(psql -tAqc "SELECT to_regclass('public.users') IS NOT NULL" 2>/dev/null)" = "t" ] || [ "$tries" -ge 120 ]; do
                tries=$((tries + 1))
                sleep 5
            done
            run_backup || log "XATO: zaxira olinmadi"
        fi
        while true; do
            if [ "$(date +%H)" -eq "$HOUR" ] && [ "$(cat "$BACKUP_DIR/.last-date" 2>/dev/null)" != "$(date +%F)" ]; then
                run_backup || log "XATO: zaxira olinmadi"
            fi
            sleep 300
        done
        ;;
    check)
        [ -f "$LAST_SUCCESS" ] && [ $(( $(date +%s) - $(cat "$LAST_SUCCESS") )) -lt 93600 ]
        ;;
    restore)
        db_file="$BACKUP_DIR/$(basename "${2:?Zaxira fayli berilmagan}")"
        [ -f "$db_file" ] || { log "Fayl topilmadi: $db_file"; exit 1; }
        pg_restore --list "$db_file" > /dev/null

        log "Baza qayta yaratilmoqda: $PGDATABASE"
        dropdb --maintenance-db=postgres --if-exists --force "$PGDATABASE"
        createdb --maintenance-db=postgres "$PGDATABASE"
        pg_restore --no-owner --no-acl --exit-on-error --dbname="$PGDATABASE" "$db_file"
        log "Baza tiklandi: $(basename "$db_file")"

        if [ -n "${3:-}" ]; then
            files_file="$BACKUP_DIR/$(basename "$3")"
            [ -f "$files_file" ] || { log "Fayl topilmadi: $files_file"; exit 1; }
            tar -xzf "$files_file" -C "$DATA_DIR"
            log "Rasmlar va hujjatlar tiklandi: $(basename "$files_file")"
        fi
        ;;
    *)
        echo "Foydalanish: backup.sh [schedule|now|check|restore DB_FAYL [FAYLLAR_ARXIVI]]" >&2
        exit 2
        ;;
esac
