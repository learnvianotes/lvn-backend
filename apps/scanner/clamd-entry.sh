#!/bin/sh
# PID 1 for the clamd container. Runs the image entrypoint, and asks clamd to reload once freshclam
# has a newer daily database than the one clamd loaded (docs/ops/scanner-host.md).
set -u
/init &
pid=$!
trap 'kill -TERM "$pid" 2>/dev/null; wait "$pid"' TERM INT
/bin/sh /opt/lvn/clamd-reload.sh &
wait "$pid"
