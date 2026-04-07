#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
#  infra/scripts/deploy.sh
#  Full production deploy script for Contabo VPS.
#
#  Usage:
#    bash /opt/property-valuation/infra/scripts/deploy.sh          # deploy all
#    bash /opt/property-valuation/infra/scripts/deploy.sh backend  # deploy backend only
#    bash /opt/property-valuation/infra/scripts/deploy.sh frontend # deploy frontend only
#
#  Called automatically by GitHub Actions on push to main,
#  or manually via SSH.
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_DIR="${DEPLOY_PATH:-/opt/property-valuation}"
INFRA_DIR="$REPO_DIR/infra"
LOG_FILE="/var/log/property-valuation-deploy.log"
TARGET="${1:-all}"   # all | backend | frontend

DEPLOY_START=$(date +%s)

log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG_FILE"; }

log "═══════════════════════════════════════════════════════"
log "🚀  Starting deployment (target: $TARGET)"
log "═══════════════════════════════════════════════════════"

# ── 1. Pull latest code ──────────────────────────────
log "📥  Pulling latest code from GitHub..."
cd "$REPO_DIR"
git fetch --all --prune
git reset --hard origin/main
COMMIT=$(git log -1 --pretty='%h %s')
log "✅  Code updated to: $COMMIT"

# ── 2. Rebuild images ────────────────────────────────
cd "$INFRA_DIR"

case "$TARGET" in
  backend)
    log "🐳  Rebuilding backend image..."
    docker compose build --no-cache backend
    log "🔄  Restarting backend..."
    docker compose up -d --no-deps backend
    ;;
  frontend)
    log "🐳  Rebuilding frontend image..."
    docker compose build --no-cache frontend
    log "🔄  Restarting frontend..."
    docker compose up -d --no-deps frontend
    ;;
  all|*)
    log "🐳  Rebuilding all images..."
    docker compose pull --quiet 2>/dev/null || true
    docker compose build --no-cache backend frontend
    log "🔄  Restarting all services..."
    docker compose up -d --remove-orphans
    ;;
esac

# ── 3. Prune unused images ──────────────────────────
log "🧹  Pruning dangling images..."
docker image prune -f --filter "until=2h"

# ── 4. Health checks ────────────────────────────────
check_health() {
  local CONTAINER=$1
  local NAME=$2
  local MAX_ATTEMPTS=${3:-15}

  log "🩺  Waiting for $NAME health check..."
  for i in $(seq 1 "$MAX_ATTEMPTS"); do
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo "missing")
    if [ "$STATUS" = "healthy" ]; then
      log "✅  $NAME is healthy!"
      return 0
    fi
    log "   Attempt $i/$MAX_ATTEMPTS – status: $STATUS. Waiting 10s..."
    sleep 10
  done

  log "❌  $NAME health check failed after $((MAX_ATTEMPTS * 10))s!"
  docker inspect --format='{{range .State.Health.Log}}{{printf "%s exit=%d %s\n" .End .ExitCode .Output}}{{end}}' "$CONTAINER" 2>/dev/null | while IFS= read -r line; do
    [ -n "$line" ] && log "   health: $line"
  done
  docker compose logs --tail=30 "$NAME" 2>/dev/null || true
  return 1
}

HEALTH_OK=true

if [ "$TARGET" = "all" ] || [ "$TARGET" = "backend" ]; then
  check_health "property_valuation_api" "backend" 15 || HEALTH_OK=false
fi

if [ "$TARGET" = "all" ] || [ "$TARGET" = "frontend" ]; then
  check_health "property_valuation_frontend" "frontend" 18 || HEALTH_OK=false
fi

# ── 5. Summary ──────────────────────────────────────
DEPLOY_END=$(date +%s)
DURATION=$((DEPLOY_END - DEPLOY_START))

log "═══════════════════════════════════════════════════════"
if [ "$HEALTH_OK" = true ]; then
  log "🎉  Deployment complete! (${DURATION}s)"
  log "    Commit: $COMMIT"
  log "    Target: $TARGET"
else
  log "⚠️   Deployment finished with health check warnings (${DURATION}s)"
  log "    Check: docker compose logs --tail=50"
fi
log "═══════════════════════════════════════════════════════"

# Exit with error if health checks failed
[ "$HEALTH_OK" = true ] || exit 1
