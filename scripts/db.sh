#!/usr/bin/env bash
# 本機開發用 MySQL（Docker）管理腳本：建立 / 備份 / 還原 / 停止
# 用法：bash scripts/db.sh <up|backup|restore|status|down> [檔案]
set -euo pipefail

CONTAINER="${DB_CONTAINER:-venue-mysql}"
IMAGE="${DB_IMAGE:-mysql:8.4}"
DB_NAME="${DB_NAME:-venue_booking}"
DB_ROOT_PASSWORD="${DB_ROOT_PASSWORD:-rootpass}"
DB_USER="${DB_USER:-venue}"
DB_PASSWORD="${DB_PASSWORD:-venuepass}"
DB_PORT="${DB_PORT:-3306}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/db-backup}"
DEFAULT_FILE="$BACKUP_DIR/venue_booking.sql"

# 避免 Git Bash 把容器內的 /path 參數轉成 Windows 路徑
export MSYS_NO_PATH_CONV=1

die() { echo "錯誤：$*" >&2; exit 1; }

require_docker() {
  command -v docker >/dev/null 2>&1 || die "找不到 docker，請先安裝並啟動 Docker Desktop。"
  docker info >/dev/null 2>&1 || die "Docker 沒有在執行，請先啟動 Docker Desktop。"
}

container_exists()  { docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER"; }
container_running() { docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; }

wait_ready() {
  echo "等待 MySQL 啟動..."
  local ok=0
  for _ in $(seq 1 60); do
    # 初始化期間會有暫時性伺服器，需連續兩次成功才算就緒
    if docker exec "$CONTAINER" mysqladmin ping -uroot -p"$DB_ROOT_PASSWORD" --silent >/dev/null 2>&1; then
      ok=$((ok + 1))
      [ "$ok" -ge 2 ] && return 0
    else
      ok=0
    fi
    sleep 2
  done
  die "MySQL 啟動逾時。"
}

cmd_up() {
  require_docker
  if container_running; then
    echo "容器 $CONTAINER 已在執行。"
  elif container_exists; then
    docker start "$CONTAINER" >/dev/null
    echo "已啟動既有容器 $CONTAINER。"
  else
    docker run -d --name "$CONTAINER" \
      -e MYSQL_ROOT_PASSWORD="$DB_ROOT_PASSWORD" \
      -e MYSQL_DATABASE="$DB_NAME" \
      -e MYSQL_USER="$DB_USER" \
      -e MYSQL_PASSWORD="$DB_PASSWORD" \
      -p "$DB_PORT:3306" \
      "$IMAGE" --character-set-server=utf8mb4 >/dev/null
    echo "已建立容器 $CONTAINER（$IMAGE）。"
  fi
  wait_ready
  # trigger 需要此設定，否則 migration 003 / 007 會因權限失敗（容器重啟後需重設）
  docker exec "$CONTAINER" mysql -uroot -p"$DB_ROOT_PASSWORD" \
    -e "SET GLOBAL log_bin_trust_function_creators=1" 2>/dev/null
  echo "資料庫就緒：mysql://$DB_USER:$DB_PASSWORD@127.0.0.1:$DB_PORT/$DB_NAME"
}

cmd_backup() {
  require_docker
  container_running || die "容器 $CONTAINER 沒有在執行，請先執行：bash scripts/db.sh up"
  local file="${1:-$DEFAULT_FILE}"
  mkdir -p "$(dirname "$file")"
  local tmp="$file.tmp"
  docker exec "$CONTAINER" mysqldump -uroot -p"$DB_ROOT_PASSWORD" \
    --single-transaction --routines --triggers --events \
    --default-character-set=utf8mb4 --databases "$DB_NAME" 2>/dev/null \
    | sed -E '/50003 TRIGGER/ s#; \*/;;$# */;;#' >"$tmp" \
    || { rm -f "$tmp"; die "匯出失敗。"; }
  # 上面的 sed：migration 建立 trigger 時本體帶有結尾分號，mysqldump 會原樣寫出
  # 「...; */;;」，還原時會被當成兩個語句而語法錯誤，所以在此移除多餘分號。
  [ -s "$tmp" ] || { rm -f "$tmp"; die "匯出內容為空。"; }
  mv "$tmp" "$file"
  echo "已匯出：$file（$(wc -c <"$file") bytes）"
}

cmd_restore() {
  require_docker
  container_running || die "容器 $CONTAINER 沒有在執行，請先執行：bash scripts/db.sh up"
  local file="${1:-$DEFAULT_FILE}"
  [ -f "$file" ] || die "找不到備份檔：$file"
  echo "即將以 $file 覆蓋資料庫 $DB_NAME 的現有資料。"
  if [ "${FORCE:-0}" != "1" ]; then
    read -r -p "確定要還原嗎？輸入 yes 繼續：" answer
    [ "$answer" = "yes" ] || die "已取消。"
  fi
  docker exec "$CONTAINER" mysql -uroot -p"$DB_ROOT_PASSWORD" \
    -e "SET GLOBAL log_bin_trust_function_creators=1" 2>/dev/null
  docker exec -i "$CONTAINER" mysql -uroot -p"$DB_ROOT_PASSWORD" \
    --default-character-set=utf8mb4 <"$file" 2>/dev/null \
    || die "還原失敗。"
  echo "已還原：$file"
}

cmd_status() {
  require_docker
  if container_running; then
    echo "容器 $CONTAINER：執行中"
    docker exec "$CONTAINER" mysql -uroot -p"$DB_ROOT_PASSWORD" --default-character-set=utf8mb4 \
      -e "SELECT 'users' t, COUNT(*) n FROM $DB_NAME.users UNION ALL SELECT 'venues', COUNT(*) FROM $DB_NAME.venues UNION ALL SELECT 'bookings', COUNT(*) FROM $DB_NAME.bookings" 2>/dev/null || true
  elif container_exists; then
    echo "容器 $CONTAINER：已停止（bash scripts/db.sh up 可啟動）"
  else
    echo "容器 $CONTAINER：不存在（bash scripts/db.sh up 可建立）"
  fi
}

cmd_down() {
  require_docker
  container_exists || { echo "容器 $CONTAINER 不存在。"; return 0; }
  docker stop "$CONTAINER" >/dev/null
  echo "已停止容器 $CONTAINER（資料保留，up 可再啟動）。"
  if [ "${REMOVE:-0}" = "1" ]; then
    docker rm "$CONTAINER" >/dev/null
    echo "已刪除容器 $CONTAINER（資料已清除，請用 restore 還原備份）。"
  fi
}

usage() {
  cat <<EOF
用法：bash scripts/db.sh <指令> [備份檔]

  up                建立並啟動 MySQL 容器（已存在則直接啟動）
  backup [檔案]     匯出資料庫，預設 db-backup/venue_booking.sql
  restore [檔案]    還原資料庫（會覆蓋現有資料，需輸入 yes；FORCE=1 可略過）
  status            顯示容器狀態與資料筆數
  down              停止容器（REMOVE=1 同時刪除容器）

可用環境變數覆寫：DB_CONTAINER DB_IMAGE DB_NAME DB_ROOT_PASSWORD DB_USER DB_PASSWORD DB_PORT BACKUP_DIR
EOF
}

case "${1:-}" in
  up)      cmd_up ;;
  backup)  shift; cmd_backup "$@" ;;
  restore) shift; cmd_restore "$@" ;;
  status)  cmd_status ;;
  down)    cmd_down ;;
  *)       usage; [ -z "${1:-}" ] || exit 1 ;;
esac
