#!/bin/sh
# The ClamAV image ships an old database. When that database is already on the volume, clamd loads it
# and a later freshclam download does not always reload it, so /readyz stays not-ready. This waits until
# clamd answers, and sends RELOAD once the daily file's version is newer than the one clamd reports.
# One reload, then it exits. /init keeps running.
set -u
HOST="${CLAMAV_HOST:-127.0.0.1}"
PORT="${CLAMAV_PORT:-3310}"
DB="${CLAMAV_DB:-/var/lib/clamav}"
INTERVAL="${CLAMAV_RELOAD_INTERVAL:-15}"
END=$(( $(date +%s) + ${CLAMAV_RELOAD_DEADLINE:-2700} ))
sent=0

clam() {
  printf 'n%s\n' "$1" | nc -w 5 "$HOST" "$PORT" 2>/dev/null | tr -d '\r' | head -n 1
}

disk_daily() {
  for name in daily.cld daily.cvd; do
    if [ -f "$DB/$name" ]; then
      awk -F: 'NR==1 && /^ClamAV-VDB:/ { print $3; exit }' "$DB/$name"
      return
    fi
  done
  echo 0
}

while [ "$(date +%s)" -lt "$END" ]; do
  pong=$(clam PING || true)
  case "$pong" in
    PONG*) ;;
    *) sleep "$INTERVAL"; continue ;;
  esac
  disk=$(disk_daily)
  loaded=$(clam VERSION | awk -F/ 'NR==1 && /^ClamAV / { print $2; exit }')
  disk=${disk:-0}
  loaded=${loaded:-0}
  case "$disk" in *[!0-9]*) disk=0 ;; esac
  case "$loaded" in *[!0-9]*) loaded=0 ;; esac
  if [ "$disk" -gt 0 ] && [ "$loaded" -gt 0 ] && [ "$disk" -le "$loaded" ]; then
    echo "clamd database $loaded is current"
    exit 0
  fi
  if [ "$disk" -gt "$loaded" ] && [ "$loaded" -gt 0 ] && [ "$sent" -ne "$disk" ]; then
    echo "clamd RELOAD (loaded $loaded, disk $disk)"
    clam RELOAD >/dev/null || true
    sent=$disk
  fi
  sleep "$INTERVAL"
done
echo "clamd database was not reloaded before the deadline"
exit 0
