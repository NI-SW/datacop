#!/bin/bash
# Start DataCop services: server (:3001), client (:5173), MCP (:8301)
# Idempotent — safe to run repeatedly; already-listening services are skipped.

set -u

# node/npm live in nvm; systemd units won't have this on PATH
export PATH=/root/.nvm/versions/node/v22.22.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

ROOT=/home/github/datacop
LOG_DIR=/tmp
SERVER_LOG=$LOG_DIR/datacop-server.log
CLIENT_LOG=$LOG_DIR/datacop-client.log
MCP_LOG=$LOG_DIR/datacop-mcp.log
DB_HOST=192.168.34.65
DB_PORT=3306

log() { echo "[$(date '+%F %T')] $*"; }

port_up() {
    ss -tln 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$1\$"
}

wait_for_db() {
    local tries=60
    log "waiting for MySQL $DB_HOST:$DB_PORT ..."
    for i in $(seq 1 "$tries"); do
        if (echo > /dev/tcp/$DB_HOST/$DB_PORT) >/dev/null 2>&1; then
            log "MySQL is reachable"
            return 0
        fi
        log "MySQL not ready ($i/$tries), retry in 5s"
        sleep 5
    done
    log "WARNING: MySQL still unreachable after $tries tries, starting anyway"
    return 0
}

start_mcp() {
    if port_up 8301; then
        log "MCP      :8301 already running, skip"
        return 0
    fi
    log "starting MCP ..."
    cd "$ROOT/mcp/python" || return 1
    # run.sh traps SIGHUP so the process survives terminal hangups
    nohup "$ROOT/mcp/python/run.sh" >> "$MCP_LOG" 2>&1 &
    disown
}

start_server() {
    if port_up 3001; then
        log "server   :3001 already running, skip"
        return 0
    fi
    log "starting server ..."
    cd "$ROOT/server" || return 1
    nohup npm run start >> "$SERVER_LOG" 2>&1 &
    disown
}

start_client() {
    if port_up 5173; then
        log "client   :5173 already running, skip"
        return 0
    fi
    log "starting client ..."
    cd "$ROOT/client" || return 1
    nohup npm run dev -- --host 0.0.0.0 >> "$CLIENT_LOG" 2>&1 &
    disown
}

log "=== DataCop start ==="
wait_for_db
start_mcp
start_server
start_client

log "waiting for ports to come up ..."
for i in $(seq 1 30); do
    ok=1
    port_up 8301 || ok=0
    port_up 3001 || ok=0
    port_up 5173 || ok=0
    [ "$ok" -eq 1 ] && break
    sleep 2
done

log "=== status ==="
for name_port in "MCP 8301" "server 3001" "client 5173"; do
    set -- $name_port
    if port_up "$2"; then
        log "  [OK]   $1 :$2"
    else
        log "  [FAIL] $1 :$2  (see ${LOG_DIR}/datacop-${1}.log)"
    fi
done
log "=== done ==="
