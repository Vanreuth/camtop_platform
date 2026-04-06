# CamTop Deploy Workflow

## How to deploy to your VPS

This describes the full CI/CD pipeline and manual deployment process.

## Automatic Deploy (CI/CD via GitHub Actions)

> Requires self-hosted runner on VPS + GitHub billing resolved.

Every push to `main` triggers:

```
Push to main
    │
    ▼
🔍 Lint & Type-check (Node.js on VPS)
    │  ├── Backend: npm install → tsc --noEmit
    │  └── Frontend: npm install → tsc --noEmit
    │ pass
    ▼
🐳 Deploy (runs deploy.sh on VPS)
    ├── git pull latest code
    ├── docker compose build --no-cache
    ├── docker compose up -d
    ├── health check backend (up to 2.5 min)
    ├── health check frontend (up to 2 min)
    └── ✅ Done
```

### Manual trigger (choose target)

Go to: **GitHub → Actions → Deploy CamTop Property Valuation → Run workflow**

Options:
- **Target**: `all`, `backend`, or `frontend`
- **Skip checks**: skip lint & type-check for faster deploy

---

## Manual Deploy (SSH into VPS)

When CI/CD is unavailable, SSH into the server and run:

### Deploy everything

```bash
cd /opt/property-valuation
bash infra/scripts/deploy.sh
```

### Deploy only backend

```bash
bash /opt/property-valuation/infra/scripts/deploy.sh backend
```

### Deploy only frontend

```bash
bash /opt/property-valuation/infra/scripts/deploy.sh frontend
```

---

## Quick manual deploy (without script)

```bash
cd /opt/property-valuation
git pull origin main
cd infra

# Backend only:
docker compose build --no-cache backend && docker compose up -d backend

# Frontend only:
docker compose build --no-cache frontend && docker compose up -d frontend

# Both:
docker compose build --no-cache && docker compose up -d
```

---

## Check deployment status

```bash
# All containers
docker ps

# Backend logs
docker logs property_valuation_api --tail 30

# Frontend logs
docker logs property_valuation_frontend --tail 30

# Deploy log file
tail -50 /var/log/property-valuation-deploy.log
```

---

## Scheduled daily backup

Runs automatically at **02:00 AM Phnom Penh time** (19:00 UTC) via:
- Docker `db-backup` container cron job
- GitHub Actions schedule (redundant trigger)

### Manual backup

```bash
docker exec property_valuation_db_backup sh /backup-db.sh
```

### Check backups

```bash
docker exec property_valuation_db_backup ls -lh /backups/
```
