#!/bin/bash
# Stop DataCop services: server (:3001), client (:5173), MCP (:8301)
# Only touches processes whose cwd is under /home/github/datacop —
# leaves /home/github/datacop-test and everything else alone.

set -u

log() { echo "[$(date '+%F %T')] $*"; }

PROJECT_DIRS=(
    /home/github/datacop/server
    /home/github/datacop/client
    /home/github/datacop/mcp/python
)

kill_tree() {
    local pid=$1 label=$2
    [ -d "/proc/$pid" ] || return 0
    log "stopping $label (pid $pid)"
    kill "$pid" 2>/dev/null
    for _ in 1 2 3 4 5; do
        [ -d "/proc/$pid" ] || return 0
        sleep 1
    done
    log "  force kill $label (pid $pid)"
    kill -9 "$pid" 2>/dev/null
}

log "=== DataCop stop ==="

# Collect PIDs whose cwd lives inside this project's service dirs.
targets=()
for dir in "${PROJECT_DIRS[@]}"; do
    for pid in $(ls /proc | grep -E '^[0-9]+$'); do
        cwd=$(readlink "/proc/$pid/cwd" 2>/dev/null || true)
        [ "$cwd" = "$dir" ] || continue
        args=$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)
        # only service processes, not editors / shells sitting in that dir
        case "$args" in
            *tsx*|*vite*|*esbuild*|*npm*|*python*|*server.py*)
                targets+=("$pid")
                ;;
        esac
    done
done

# de-duplicate
if [ "${#targets[@]}" -gt 0 ]; then
    mapfile -t targets < <(printf '%s\n' "${targets[@]}" | awk '!seen[$0]++')
fi

if [ "${#targets[@]}" -eq 0 ]; then
    log "no DataCop processes found by cwd"
else
    log "found ${#targets[@]} process(es): ${targets[*]}"
    # kill higher-level parents first (npm wrappers), then the rest
    for pid in "${targets[@]}"; do
        kill_tree "$pid" "pid $pid"
    done
fi

# Final sweep: anything still bound to our ports whose cwd is in this project.
for name_port in "MCP 8301" "server 3001" "client 5173"; do
    set -- $name_port
    leftover=$(ss -tlnp 2>/dev/null | awk -v p=":$2" '$4 ~ p"$"' | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)
    for pid in $leftover; do
        cwd=$(readlink "/proc/$pid/cwd" 2>/dev/null || true)
        case "$cwd" in
            /home/github/datacop/*)
                kill_tree "$pid" "$1 :$2 leftover pid $pid"
                ;;
        esac
    done
done

log "=== status ==="
for name_port in "MCP 8301" "server 3001" "client 5173"; do
    set -- $name_port
    if ss -tln 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$2\$"; then
        log "  [UP]   $1 :$2"
    else
        log "  [DOWN] $1 :$2"
    fi
done
log "=== done ==="
