# CamTop Property Valuation – Full Deployment Guide

> Complete step-by-step guide to deploy the CamTop Property Valuation System on a Contabo VPS with Docker, Nginx Proxy Manager, PostgreSQL/PostGIS, and Cloudflare DNS.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Server Setup (Contabo VPS)](#3-server-setup-contabo-vps)
4. [DNS Configuration (Cloudflare)](#4-dns-configuration-cloudflare)
5. [Environment Configuration](#5-environment-configuration)
6. [Deploy Application](#6-deploy-application)
7. [Nginx Proxy Manager Setup](#7-nginx-proxy-manager-setup)
8. [Database Seeding](#8-database-seeding)
9. [CI/CD Setup (GitHub Actions)](#9-cicd-setup-github-actions)
10. [Post-Deployment Verification](#10-post-deployment-verification)
11. [Maintenance & Operations](#11-maintenance--operations)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Architecture Overview

```
                    Internet
                       │
                   Cloudflare
                   (DNS + CDN)
                       │
              ┌────────┴────────┐
              │   Contabo VPS   │
              │ 207.180.226.102 │
              │                 │
              │  ┌───────────┐  │
              │  │   Nginx   │  │
     :80/:443 │  │   Proxy   │  │  :81 (Admin)
       ───────┤  │  Manager  │  │
              │  └─────┬─────┘  │
              │        │        │
              │   proxy network │
              │   ┌────┴────┐   │
              │   │         │   │
              │ :3000     :4000 │
              │ ┌─────┐ ┌─────┐│
              │ │Front│ │Back ││
              │ │ end │ │ end ││
              │ └─────┘ └──┬──┘│
              │    internal│net │
              │         ┌──┴──┐│
              │         │Post-││
              │         │greSQL│
              │         │+GIS ││
              │         └─────┘│
              └────────────────┘
```

| Component | Technology | Port | Domain |
|---|---|---|---|
| Frontend | Next.js 16 (standalone) | 3000 | camtopproperty.site |
| Backend API | Express + Prisma + TypeScript | 4000 | api.camtopproperty.site |
| Database | PostgreSQL 15 + PostGIS 3.4 | 5432 | internal only |
| Proxy | Nginx Proxy Manager | 80/443/81 | – |
| Storage | Cloudflare R2 | – | cdn.camtopproperty.site |
| DB Backup | Automated daily (cron) | – | – |

---

## 2. Prerequisites

### Required Accounts
- [x] **Contabo VPS** – Ubuntu 22.04, minimum 4GB RAM
- [x] **GitHub** – Repository: `Vanreuth/camtop_platform`
- [x] **Cloudflare** – Domain: `camtopproperty.site`
- [x] **Google Cloud Console** – OAuth Client ID + Maps API Key
- [x] **Cloudflare R2** – Object storage bucket
- [x] **Resend** – Email delivery (API key)

### Required Software on VPS
- Docker Engine + Docker Compose
- Git
- Node.js 20 (for CI/CD runner)

---

## 3. Server Setup (Contabo VPS)

### 3.1 Connect to Server

```bash
ssh root@207.180.226.102
```

### 3.2 Create Deploy User

```bash
# Create deploy user (never deploy as root)
adduser deploy
usermod -aG sudo deploy
usermod -aG docker deploy

# Switch to deploy user
su - deploy
```

### 3.3 Install Docker

```bash
# Install Docker Engine
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Verify
docker --version
docker compose version
```

### 3.4 Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

node --version   # v20.x.x
npm --version    # 10.x.x
```

### 3.5 Install Git

```bash
sudo apt-get install -y git
git --version
```

### 3.6 Configure Firewall (UFW)

```bash
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS
sudo ufw allow 81/tcp     # NPM Admin (remove after setup)
sudo ufw enable
sudo ufw status
```

### 3.7 Clone Repository

```bash
sudo mkdir -p /opt/property-valuation
sudo chown deploy:deploy /opt/property-valuation

cd /opt/property-valuation
git clone https://github.com/Vanreuth/camtop_platform.git .
```

---

## 4. DNS Configuration (Cloudflare)

Go to **Cloudflare Dashboard → DNS → Records** and add:

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `camtopproperty.site` | `207.180.226.102` | ☁️ Proxied |
| A | `www` | `207.180.226.102` | ☁️ Proxied |
| A | `api` | `207.180.226.102` | ☁️ Proxied |
| R2 | `cdn` | R2 bucket `camtop` | ☁️ Proxied |

### Cloudflare SSL/TLS Settings

Go to **SSL/TLS → Overview**:
- Set encryption mode to **Full (Strict)**

Go to **SSL/TLS → Edge Certificates**:
- Enable **Always Use HTTPS**
- Set **Minimum TLS Version** to **1.2**

---

## 5. Environment Configuration

### 5.1 Create Production Environment File

```bash
cd /opt/property-valuation/infra
cp .env.example .env
nano .env
```

### 5.2 Fill in All Values

```env
# ═══════════════════════════════════════════════════════
#  infra/.env – Production environment for Contabo VPS
#  ⚠️  NEVER commit this file to git!
# ═══════════════════════════════════════════════════════

# ── General ──────────────────────────────────────────
TZ=Asia/Phnom_Penh

# ── PostgreSQL ────────────────────────────────────────
POSTGRES_DB=property_valuation
POSTGRES_USER=pv_user
POSTGRES_PASSWORD=<generate-strong-password>

# ── JWT ───────────────────────────────────────────────
JWT_SECRET=<generate-64-char-random-string>
JWT_EXPIRES_IN=15m                    # ⚠️ Must be "15m" NOT "15mn"
JWT_REFRESH_SECRET=<generate-64-char-random-string>
JWT_REFRESH_EXPIRES_IN=14d

# ── Application URLs ─────────────────────────────────
APP_URL=https://api.camtopproperty.site
FRONTEND_URL=https://camtopproperty.site
CORS_ORIGINS=https://camtopproperty.site,https://www.camtopproperty.site

# ── Frontend (baked into Next.js at build time) ──────
NEXT_PUBLIC_API_URL=https://api.camtopproperty.site/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=<your-google-maps-browser-key>

# ── Email ─────────────────────────────────────────────
EMAIL_PROVIDER=resend
EMAIL_FROM=noreply@camtopproperty.site
EMAIL_LOGO_URL=https://camtopproperty.site/logo/camtop_logo.svg
EMAIL_VERIFY_LINK_TARGET=backend
RESEND_API_KEY=re_<your-resend-api-key>

# ── Cloudflare R2 Storage ─────────────────────────────
CLOUDFLARE_ACCOUNT_ID=<your-account-id>
CLOUDFLARE_ACCESS_KEY_ID=<your-access-key>
CLOUDFLARE_SECRET_ACCESS_KEY=<your-secret-key>
CLOUDFLARE_BUCKET_NAME=camtop
CLOUDFLARE_BUCKET_REGION=auto
CLOUDFLARE_R2_PUBLIC_URL=https://cdn.camtopproperty.site

# ── Google Maps (Server-side) ─────────────────────────
GOOGLE_MAP_API_KEY=<your-server-map-key>
GOOGLE_GEOCODING_API_KEY=<your-geocoding-key>

# ── Backup ────────────────────────────────────────────
BACKUP_RETENTION_DAYS=14

# ── Misc ──────────────────────────────────────────────
TRUST_PROXY=1
NODE_ENV=production
PORT=4000
```

### 5.3 Generate JWT Secrets

```bash
# Generate random secrets on the server
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

> [!CAUTION]
> **Common mistakes that cause errors:**
> - `JWT_EXPIRES_IN=15mn` → ❌ Must be `15m` (no "n")
> - `CLOUDFLARE_R2_PUBLIC_URL=https://camtopproperty.site` → ❌ Must be `https://cdn.camtopproperty.site`
> - `PORT=4000` is for backend. Frontend gets PORT overridden to `3000` in docker-compose.yml

---

## 6. Deploy Application

### 6.1 Build & Start All Services

```bash
cd /opt/property-valuation/infra

# Build all images (first time takes ~3-5 minutes)
docker compose build --no-cache

# Start all services
docker compose up -d

# Verify all containers are running
docker ps
```

### 6.2 Expected Output

```
CONTAINER ID   IMAGE                             STATUS                  PORTS
xxxxxxxxx      property_valuation_frontend        Up ... (healthy)       3000/tcp
xxxxxxxxx      property_valuation_api             Up ... (healthy)       4000/tcp
xxxxxxxxx      postgis/postgis:15-3.4-alpine      Up ... (healthy)       5432/tcp
xxxxxxxxx      jc21/nginx-proxy-manager:latest     Up ... (healthy)       80, 81, 443
xxxxxxxxx      property_valuation_db_backup        Up ...                 5432/tcp
```

### 6.3 Check Logs

```bash
# Backend logs (check for migration success)
docker logs property_valuation_api --tail 20

# Expected:
# ⏳ Running Prisma migrations...
# ✅ Migrations done.
# 🚀 Starting server...
# 🚀 Server started

# Frontend logs (check port is 3000)
docker logs property_valuation_frontend --tail 10

# Expected:
# ▲ Next.js 16.x
# - Local: http://...:3000     ← MUST be 3000, not 4000
# ✓ Ready in ...ms
```

---

## 7. Nginx Proxy Manager Setup

### 7.1 Access Admin Panel

Open browser: `http://207.180.226.102:81`

Default login:
```
Email:    admin@example.com
Password: changeme
```

Change these on first login.

### 7.2 Frontend Proxy Host

**Hosts → Proxy Hosts → Add Proxy Host**

**Details tab:**

| Field | Value |
|---|---|
| Domain Names | `camtopproperty.site`, `www.camtopproperty.site` |
| Scheme | `http` |
| Forward Hostname / IP | `frontend` |
| Forward Port | `3000` |
| Block Common Exploits | ✅ |
| Websockets Support | ✅ |

**SSL tab:**

| Field | Value |
|---|---|
| SSL Certificate | Request new → Let's Encrypt |
| Force SSL | ✅ |
| HTTP/2 Support | ✅ |
| HSTS Enabled | ✅ |
| Email | your email |
| Agree to TOS | ✅ |

### 7.3 Backend API Proxy Host

**Add another Proxy Host:**

**Details tab:**

| Field | Value |
|---|---|
| Domain Names | `api.camtopproperty.site` |
| Scheme | `http` |
| Forward Hostname / IP | `backend` |
| Forward Port | `4000` |
| Block Common Exploits | ✅ |
| Websockets Support | ✅ |

**SSL tab:** Same as frontend.

**Advanced tab → Custom Nginx Configuration:**

```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_read_timeout 300;
proxy_connect_timeout 300;
```

### 7.4 Block Admin Port After Setup

```bash
sudo ufw deny 81/tcp
```

---

## 8. Database Seeding

> [!WARNING]
> The seed script **deletes ALL existing data** before inserting. Only run this ONCE on first deploy. Never run again after real data is entered.

### 8.1 Seed Data Contents

| Data | Records | Required? |
|---|---|---|
| Provinces (with GIS boundaries) | 25 | ✅ Essential |
| Districts (with GIS boundaries) | ~200 | ✅ Essential |
| Communes (with GIS boundaries) | ~1,600 | ✅ Essential |
| Villages | ~14,000 | ✅ Essential |
| Users (admin, test accounts) | 5 | ✅ First deploy |
| Roles & Permissions | 6 roles, 20 perms | ✅ Essential |
| Property Types & Subtypes | ~30 | ✅ Essential |

### 8.2 Run Seed

```bash
# Copy the latest seed file into the running container
docker cp /opt/property-valuation/property_valution_api/prisma \
  property_valuation_api:/app/prisma

# Run seed
docker exec -it property_valuation_api npx tsx prisma/seed.ts
```

### 8.3 Expected Output

```
🌱 Starting database seeding...
🧹 Cleaning existing data...
✅ Existing data cleaned!
📍 Seeding Provinces...
✅ Seeded 25 provinces.
📍 Seeding Districts...
✅ District Process Complete.
📍 Seeding Communes...
✅ Commune Process Complete.
🏘️ Seeding Villages...
✅ Seeded ~14,000 villages.
👤 Seeding users...
🔐 Seeding roles...
🔑 Seeding permissions...
🏁 Seeding Completed Successfully!
```

### 8.4 Default Login Credentials

| Username | Password | Role |
|---|---|---|
| `admin` | `12345678` | Super Administrator |
| `vanreuth` | `12345678` | Property Manager |
| `testuser` | `12345678` | Valuer |

> [!IMPORTANT]
> Change the admin password immediately after first login!

---

## 9. CI/CD Setup (GitHub Actions)

### 9.1 Install Self-Hosted Runner on VPS

This avoids GitHub billing issues (free, unlimited minutes):

```bash
# As deploy user on VPS
mkdir -p ~/actions-runner && cd ~/actions-runner

# Download runner (check GitHub for latest version)
curl -o actions-runner-linux-x64.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.323.0/actions-runner-linux-x64-2.323.0.tar.gz
tar xzf actions-runner-linux-x64.tar.gz

# Configure (get token from GitHub → Repo → Settings → Actions → Runners → New self-hosted runner)
./config.sh --url https://github.com/Vanreuth/camtop_platform --token YOUR_TOKEN_HERE

# Install as system service
sudo ./svc.sh install deploy
sudo ./svc.sh start
sudo ./svc.sh status   # Should show: active (running)
```

### 9.2 How CI/CD Works

```
Push to main
    │
    ▼
🔍 Lint & Type-check   ← runs on VPS (self-hosted)
    │  ├── Backend: tsc --noEmit
    │  └── Frontend: tsc --noEmit
    │ pass
    ▼
🐳 Deploy              ← runs deploy.sh on VPS
    ├── git reset --hard origin/main
    ├── docker compose build --no-cache
    ├── docker compose up -d
    ├── health check backend (up to 2.5 min)
    ├── health check frontend (up to 2 min)
    └── ✅ Done

💾 Daily 02:00 AM (Phnom Penh) → Automated DB Backup
```

### 9.3 Manual Trigger

Go to: **GitHub → Actions → Deploy CamTop Property Valuation → Run workflow**

Options:
- **Target**: `all` / `backend` / `frontend`
- **Skip checks**: Skip lint for faster deploy

### 9.4 Manual Deploy via SSH (When CI/CD is Unavailable)

```bash
# Deploy all
bash /opt/property-valuation/infra/scripts/deploy.sh

# Deploy only backend
bash /opt/property-valuation/infra/scripts/deploy.sh backend

# Deploy only frontend
bash /opt/property-valuation/infra/scripts/deploy.sh frontend
```

---

## 10. Post-Deployment Verification

### 10.1 Health Checks

```bash
# Backend health
curl -s https://api.camtopproperty.site/healthz | python3 -m json.tool

# Frontend
curl -s -o /dev/null -w "%{http_code}" https://camtopproperty.site

# Container status
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### 10.2 Test Login

1. Open `https://camtopproperty.site`
2. Login with `admin` / `12345678`
3. Should redirect to dashboard

### 10.3 Test API

```bash
curl -s -X POST https://api.camtopproperty.site/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"12345678"}' | python3 -m json.tool
```

### 10.4 Google OAuth

- Ensure `https://camtopproperty.site` is in **Authorized JavaScript Origins**
- Ensure callback URL is in **Authorized Redirect URIs**
- Google button should be active (not greyed out)

---

## 11. Maintenance & Operations

### 11.1 View Logs

```bash
# Backend
docker logs property_valuation_api --tail 50 -f

# Frontend
docker logs property_valuation_frontend --tail 50 -f

# All services
docker compose -f /opt/property-valuation/infra/docker-compose.yml logs -f

# Deploy history
tail -100 /var/log/property-valuation-deploy.log
```

### 11.2 Database Backup

#### How Automated Backup Works

The `db-backup` container runs a cron job inside a lightweight `postgres:15-alpine` container:

```
┌──────────────────────────────────────────────────────┐
│  db-backup container                                 │
│                                                      │
│  cron: "0 2 * * *"  ──► backup-db.sh                │
│         (02:00 AM daily, Asia/Phnom_Penh)            │
│                                                      │
│  backup-db.sh:                                       │
│    1. pg_dump → gzip → /backups/db-YYYY-MM-DD.sql.gz│
│    2. Delete backups older than 14 days              │
│    3. List remaining backups                         │
│                                                      │
│  Volume: backups:/backups  (persistent Docker volume)│
└──────────────────────────────────────────────────────┘
```

| Setting | Value | Configured in |
|---|---|---|
| Schedule | Daily 02:00 AM (Asia/Phnom_Penh) | `docker-compose.yml` → `db-backup` entrypoint |
| Retention | 14 days | `BACKUP_RETENTION_DAYS` in `infra/.env` |
| Format | `db-YYYY-MM-DD_HHMM.sql.gz` | `backup-db.sh` |
| Storage | Docker volume `backups` | `docker-compose.yml` → volumes |
| Compression | gzip -9 (max compression) | `backup-db.sh` |

#### Manual Backup

```bash
# Trigger a backup immediately
docker exec property_valuation_db_backup sh /backup-db.sh

# Expected output:
# [2026-04-06 02:00:00] 🗄  Starting backup: property_valuation → /backups/db-2026-04-06_0200.sql.gz
# [2026-04-06 02:00:05] ✅  Backup complete: db-2026-04-06_0200.sql.gz (12M)
# [2026-04-06 02:00:05] 🗑  Removing backups older than 14 days...
# [2026-04-06 02:00:05] 📦  Remaining backups:
# -rw-r--r-- 1 root root 12M Apr  6 02:00 /backups/db-2026-04-06_0200.sql.gz
```

#### List All Backups

```bash
docker exec property_valuation_db_backup ls -lh /backups/
```

#### Download Backup to Local Machine

```bash
# 1. Find the volume path on the host
docker volume inspect property-valuation_backups --format '{{ .Mountpoint }}'
# Output: /var/lib/docker/volumes/property-valuation_backups/_data

# 2. Copy backup from volume to host filesystem
sudo cp /var/lib/docker/volumes/property-valuation_backups/_data/db-2026-04-06_0200.sql.gz /home/deploy/

# 3. Download from VPS to your local machine (run on LOCAL, not VPS)
scp deploy@207.180.226.102:~/db-2026-04-06_0200.sql.gz ./backups/
```

Or copy directly from the container:

```bash
# Copy from container to VPS host
docker cp property_valuation_db_backup:/backups/db-2026-04-06_0200.sql.gz /home/deploy/

# Then SCP to local machine
scp deploy@207.180.226.102:~/db-2026-04-06_0200.sql.gz ./backups/
```

#### Restore from Backup

> [!CAUTION]
> Restoring will **overwrite all current data** in the database. Make a fresh backup before restoring if you want to preserve current state.

```bash
# Step 1: Copy backup into the database container
docker cp /home/deploy/db-2026-04-06_0200.sql.gz property_valuation_db:/tmp/

# Step 2: Stop the backend to prevent writes during restore
cd /opt/property-valuation/infra
docker compose stop backend

# Step 3: Drop and recreate the database
docker exec property_valuation_db psql -U pv_user -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='property_valuation' AND pid <> pg_backend_pid();"

docker exec property_valuation_db psql -U pv_user -d postgres -c \
  "DROP DATABASE IF EXISTS property_valuation;"

docker exec property_valuation_db psql -U pv_user -d postgres -c \
  "CREATE DATABASE property_valuation;"

# Step 4: Enable PostGIS extension
docker exec property_valuation_db psql -U pv_user -d property_valuation -c \
  "CREATE EXTENSION IF NOT EXISTS postgis;"

# Step 5: Restore the backup
docker exec property_valuation_db sh -c \
  "gunzip -c /tmp/db-2026-04-06_0200.sql.gz | psql -U pv_user -d property_valuation"

# Step 6: Restart backend
docker compose start backend

# Step 7: Verify
docker exec property_valuation_db psql -U pv_user -d property_valuation -c \
  "SELECT COUNT(*) as users FROM users; SELECT COUNT(*) as properties FROM properties;"
```

#### Verify Backup Integrity

```bash
# Test that a backup file can be decompressed and contains valid SQL
docker exec property_valuation_db_backup sh -c \
  "gunzip -t /backups/db-2026-04-06_0200.sql.gz && echo '✅ Backup file is valid' || echo '❌ Backup file is corrupted'"

# Check the first 20 lines of SQL content
docker exec property_valuation_db_backup sh -c \
  "gunzip -c /backups/db-2026-04-06_0200.sql.gz | head -20"
```

#### Change Backup Retention Period

Edit `infra/.env` on the server:

```bash
nano /opt/property-valuation/infra/.env

# Change:
BACKUP_RETENTION_DAYS=14    # keep 14 days (default)
# To, for example:
BACKUP_RETENTION_DAYS=30    # keep 30 days

# Restart the backup container to apply
docker compose -f /opt/property-valuation/infra/docker-compose.yml \
  up -d --force-recreate db-backup
```

#### Change Backup Schedule

Edit `docker-compose.yml` → `db-backup` → `entrypoint`:

```yaml
# Current: runs at 02:00 AM daily
echo '0 2 * * * sh /backup-db.sh >> /var/log/backup.log 2>&1' | crontab -

# Examples:
# Every 12 hours:  0 */12 * * *
# Every 6 hours:   0 */6 * * *
# Twice daily:     0 2,14 * * *
# Weekly Sunday:   0 2 * * 0
```

After editing, rebuild the container:
```bash
cd /opt/property-valuation/infra
docker compose up -d --force-recreate db-backup
```

#### Backup Monitoring

```bash
# Check if backup cron is running
docker exec property_valuation_db_backup crontab -l

# Check backup log
docker exec property_valuation_db_backup cat /var/log/backup.log 2>/dev/null || echo "No log yet"

# Check container uptime (should be running continuously)
docker ps --filter name=property_valuation_db_backup --format "{{.Status}}"

# Check disk usage of backups volume
docker exec property_valuation_db_backup du -sh /backups/
```

#### Backup Script Source Code

File: `infra/scripts/backup-db.sh`

```bash
#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
#  infra/scripts/backup-db.sh
#  - Dumps PostgreSQL database inside the running container
#  - Rotates backups older than $BACKUP_RETENTION_DAYS days
#  - Runs automatically from the db-backup container (daily at 02:00)
#  - Can also be invoked manually:
#      docker exec property_valuation_db_backup sh /backup-db.sh
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
DATE=$(date +%Y-%m-%d_%H%M)
RETENTION="${BACKUP_RETENTION_DAYS:-7}"

mkdir -p "$BACKUP_DIR"

echo "[$(date '+%F %T')] 🗄  Starting backup: $POSTGRES_DB → $BACKUP_DIR/db-$DATE.sql.gz"

PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  -h "$POSTGRES_HOST" \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --no-owner --no-acl \
  | gzip -9 > "$BACKUP_DIR/db-$DATE.sql.gz"

echo "[$(date '+%F %T')] ✅  Backup complete: db-$DATE.sql.gz ($(du -sh "$BACKUP_DIR/db-$DATE.sql.gz" | cut -f1))"

# Rotate old backups
echo "[$(date '+%F %T')] 🗑  Removing backups older than $RETENTION days..."
find "$BACKUP_DIR" -maxdepth 1 -type f -name "*.sql.gz" -mtime "+$RETENTION" -delete
echo "[$(date '+%F %T')] 📦  Remaining backups:"
ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null || echo "  (none)"
```

**What the script does step by step:**

1. Sets backup directory (`/backups` inside container, mounted as Docker volume)
2. Creates filename with current timestamp: `db-2026-04-06_0200.sql.gz`
3. Runs `pg_dump` connecting to the PostgreSQL container via the `internal` Docker network
4. Pipes output through `gzip -9` (maximum compression) to save disk space
5. Uses `--no-owner --no-acl` flags so the backup can be restored without matching the original DB user
6. Deletes backups older than `BACKUP_RETENTION_DAYS` (default: 14 days)
7. Lists remaining backups with file sizes

#### Docker Compose DB Backup Service

In `infra/docker-compose.yml`:

```yaml
  # ── Daily DB Backup (cron-style) ─────────────
  db-backup:
    image: postgres:15-alpine
    container_name: property_valuation_db_backup
    restart: unless-stopped
    environment:
      POSTGRES_USER:     ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB:       ${POSTGRES_DB}
      POSTGRES_HOST:     postgres          # connects via internal network
      TZ:                ${TZ:-Asia/Phnom_Penh}
      BACKUP_RETENTION_DAYS: ${BACKUP_RETENTION_DAYS:-7}
    volumes:
      - backups:/backups                           # persistent volume
      - ./scripts/backup-db.sh:/backup-db.sh:ro    # script mounted read-only
    networks:
      - internal                                   # same network as postgres
    depends_on:
      postgres:
        condition: service_healthy                 # waits for DB to be ready
    entrypoint: >
      sh -c "
        apk add --no-cache dcron &&
        echo '0 2 * * * sh /backup-db.sh >> /var/log/backup.log 2>&1' | crontab - &&
        sh /backup-db.sh &&
        crond -f -l 6
      "
```

**How the entrypoint works:**

1. `apk add dcron` — installs the cron daemon (Alpine Linux)
2. `crontab` — registers the backup job at 02:00 AM daily
3. `sh /backup-db.sh` — runs an **immediate backup** on first start
4. `crond -f` — starts the cron daemon in the foreground (keeps container alive)

**Key design decisions:**

| Decision | Why |
|---|---|
| Uses `postgres:15-alpine` image | Already has `pg_dump` built-in, no extra install needed |
| Separate container from main DB | Doesn't add load to the production database container |
| `restart: unless-stopped` | Container auto-restarts after VPS reboot |
| Volume `backups` | Data persists even if container is rebuilt |
| `internal` network only | Backup container can reach DB but not the internet |
| Runs backup on start | Ensures at least one backup exists immediately |

#### Backup Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_USER` | `pv_user` | DB user for pg_dump |
| `POSTGRES_PASSWORD` | — | DB password (from `infra/.env`) |
| `POSTGRES_DB` | `property_valuation` | Database name to dump |
| `POSTGRES_HOST` | `postgres` | Docker service name of PostgreSQL container |
| `TZ` | `Asia/Phnom_Penh` | Timezone for cron schedule and log timestamps |
| `BACKUP_RETENTION_DAYS` | `7` (`.env.example`: `14`) | Days to keep old backups before auto-deleting |
| `BACKUP_DIR` | `/backups` | Directory inside container where dumps are saved |

#### Quick Reference Cheat Sheet

```bash
# ═══════════════════════════════════════════════
#  DB Backup – Quick Reference
# ═══════════════════════════════════════════════

# ── Create backup now ────────────────────────
docker exec property_valuation_db_backup sh /backup-db.sh

# ── List all backups ─────────────────────────
docker exec property_valuation_db_backup ls -lh /backups/

# ── Check backup size ───────────────────────
docker exec property_valuation_db_backup du -sh /backups/

# ── Verify a backup file ────────────────────
docker exec property_valuation_db_backup gunzip -t /backups/db-YYYY-MM-DD_HHMM.sql.gz

# ── Download backup to local machine ────────
docker cp property_valuation_db_backup:/backups/db-YYYY-MM-DD_HHMM.sql.gz /home/deploy/
scp deploy@207.180.226.102:~/db-YYYY-MM-DD_HHMM.sql.gz ./    # run on LOCAL

# ── Restore (⚠️ overwrites all data) ────────
docker cp /home/deploy/db-YYYY-MM-DD_HHMM.sql.gz property_valuation_db:/tmp/
docker compose -f /opt/property-valuation/infra/docker-compose.yml stop backend
docker exec property_valuation_db psql -U pv_user -d postgres -c "DROP DATABASE IF EXISTS property_valuation;"
docker exec property_valuation_db psql -U pv_user -d postgres -c "CREATE DATABASE property_valuation;"
docker exec property_valuation_db psql -U pv_user -d property_valuation -c "CREATE EXTENSION IF NOT EXISTS postgis;"
docker exec property_valuation_db sh -c "gunzip -c /tmp/db-YYYY-MM-DD_HHMM.sql.gz | psql -U pv_user -d property_valuation"
docker compose -f /opt/property-valuation/infra/docker-compose.yml start backend

# ── Check cron status ───────────────────────
docker exec property_valuation_db_backup crontab -l
docker exec property_valuation_db_backup cat /var/log/backup.log

# ── Check container is running ──────────────
docker ps --filter name=property_valuation_db_backup
```

### 11.3 Update Environment Variables

```bash
# Edit env file
nano /opt/property-valuation/infra/.env

# ── For BACKEND env changes (runtime): just restart ──
docker compose -f /opt/property-valuation/infra/docker-compose.yml \
  up -d --force-recreate backend

# ── For FRONTEND NEXT_PUBLIC_* changes: MUST rebuild ──
# (These are baked in at build time)
cd /opt/property-valuation/infra
docker compose build --no-cache frontend
docker compose up -d frontend
```

### 11.4 Database Migrations

Migrations run automatically on every container start via:
```
npx prisma migrate deploy
```

To run manually:
```bash
docker exec -it property_valuation_api npx prisma migrate deploy
```

### 11.5 Restart Services

```bash
cd /opt/property-valuation/infra

# Restart single service
docker compose restart backend
docker compose restart frontend

# Restart all
docker compose restart

# Full rebuild + restart
docker compose build --no-cache && docker compose up -d
```

### 11.6 Disk Space

```bash
# Check disk usage
df -h /

# Clean unused Docker resources
docker system prune -a --volumes   # ⚠️ removes everything unused
docker image prune -f              # safe: only dangling images
```

---

## 12. Troubleshooting

### 502 Bad Gateway

| Cause | Fix |
|---|---|
| Frontend running on wrong port | Check `docker logs property_valuation_frontend`. If port is 4000 instead of 3000, add `PORT: "3000"` to frontend environment in docker-compose.yml |
| Container not ready yet | Wait 30s for the health check to pass |
| Frontend/backend not on proxy network | Check `docker network inspect` |

### Login Returns "Internal Server Error"

| Cause | Fix |
|---|---|
| `JWT_EXPIRES_IN=15mn` (typo) | Fix to `15m` in `infra/.env`, restart backend |
| Database not seeded | Run seed as described in Section 8 |
| Database connection failed | Check `DATABASE_URL` in docker compose logs |

### "Google sign-in is not configured"

| Cause | Fix |
|---|---|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` missing | Set in `infra/.env` and **rebuild** frontend |
| Not baked at build time | Frontend must be rebuilt with `docker compose build --no-cache frontend` |

### Images Not Loading (from R2)

| Cause | Fix |
|---|---|
| `CLOUDFLARE_R2_PUBLIC_URL` is wrong | Must be `https://cdn.camtopproperty.site`, not `https://camtopproperty.site` |
| R2 bucket public access disabled | Enable in Cloudflare R2 → bucket → Settings |
| Old image URLs in DB have wrong domain | Run SQL UPDATE to replace domain |

### npm ci Fails in Docker Build

| Cause | Fix |
|---|---|
| Lock file generated on Windows | Use `npm install` instead of `npm ci` in Dockerfile |
| Missing `@swc/helpers` | Already fixed in `Dockerfile.prod` |

### Container Shows "unhealthy"

```bash
# Check why health check fails
docker inspect --format='{{json .State.Health}}' <container_name> | python3 -m json.tool

# Check if the port is actually listening
docker exec <container_name> wget -qO- http://localhost:<port>/
```

---

## File Structure Reference

```
camtop_platform/
├── .github/
│   └── workflows/
│       └── deploy.yml              # CI/CD pipeline
├── infra/
│   ├── .env                        # ⚠️ production secrets (NOT in git)
│   ├── .env.example                # template for .env
│   ├── docker-compose.yml          # all services definition
│   ├── scripts/
│   │   ├── deploy.sh               # deployment script
│   │   └── backup-db.sh            # DB backup script
│   └── backups/                    # backup volume mount
├── property_valution_api/
│   ├── Dockerfile.prod             # backend Docker image
│   ├── init-postgis.sql            # PostGIS init script
│   ├── prisma/
│   │   ├── schema.prisma           # database schema
│   │   ├── seed.ts                 # seed data script
│   │   ├── data/                   # CSV + GeoJSON seed data
│   │   └── migrations/             # Prisma migrations
│   └── src/                        # backend source code
└── property_valution_system/
    ├── Dockerfile.prod             # frontend Docker image
    ├── .env                        # local dev env (localhost)
    └── src/                        # frontend source code
```
