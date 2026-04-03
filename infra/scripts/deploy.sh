#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
#  infra/scripts/deploy.sh
#  Called by GitHub Actions (via SSH) on every push to main.
#  Usage: bash /opt/property-valuation/infra/scripts/deploy.sh
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_DIR="${DEPLOY_PATH:-/opt/property-valuation}"
INFRA_DIR="$REPO_DIR/infra"
LOG_FILE="/var/log/property-valuation-deploy.log"

log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG_FILE"; }

log "═══════════════════════════════════════"
log "🚀  Starting deployment"
log "═══════════════════════════════════════"

# ── 1. Pull latest code ──────────────────
log "📥  Pulling latest code from GitHub..."
cd "$REPO_DIR"
git fetch --all
git reset --hard origin/main
log "✅  Code updated to: $(git log -1 --pretty='%h %s')"

# ── 2. Rebuild & restart containers ─────
log "🐳  Rebuilding Docker images..."
cd "$INFRA_DIR"
docker compose pull --quiet || true
docker compose build --no-cache

log "🔄  Restarting services..."
docker compose up -d --remove-orphans

# ── 3. Prune unused images ───────────────
log "🧹  Pruning dangling images..."
docker image prune -f

# ── 4. Health check ──────────────────────
log "🩺  Waiting for backend health check..."
for i in $(seq 1 12); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' property_valuation_api 2>/dev/null || echo "missing")
  if [ "$STATUS" = "healthy" ]; then
    log "✅  Backend is healthy!"
    break
  fi
  log "   Attempt $i/12 – status: $STATUS. Waiting 10s..."
  sleep 10
done

if [ "$STATUS" != "healthy" ]; then
  log "❌  Backend health check failed after 2 minutes!"
  docker compose logs --tail=50 backend
  exit 1
fi

log "🎉  Deployment complete!"
log "═══════════════════════════════════════"
