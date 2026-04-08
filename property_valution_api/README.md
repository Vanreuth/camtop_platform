# Property Valuation API

Backend service for CamTop Property Valuation. It provides authentication, user and role management, property records, full valuations, indicative valuations, exports, notifications, audit logs, and supporting integrations for geolocation and file uploads.

## Stack

- Node.js + TypeScript
- Express 5
- Prisma ORM
- PostgreSQL + PostGIS
- Redis cache
- Zod validation
- Multer file uploads

## Main Capabilities

- Auth with access-token and refresh-token flow
- Users, roles, and permissions
- Property CRUD with address and location data
- Full property valuations
- Indicative valuations with PDF and Excel export
- Notifications and audit logs
- Cloudflare R2 file storage
- Google geocoding and maps integration

## URLs and Ports

The API listens on `PORT`.

- `.env.example` defaults to `3600`
- Docker development is preconfigured for `4000`
- Health check: `/healthz`
- API prefix: `/api`

Examples:

- Base URL: `http://localhost:4000`
- API prefix: `http://localhost:4000/api`
- Health check: `http://localhost:4000/healthz`

## Development

### Option 1: Docker Compose development

Use this when you want the full local stack with API, PostGIS, Redis, and pgAdmin.

Files used:

- `docker-compose.dev.yml`
- `Dockerfile.dev`
- `.env.development`

Start the stack:

```bash
npm run docker:dev
```

Or directly:

```bash
docker-compose -f docker-compose.dev.yml up --build -d
```

Services:

- API: `http://localhost:4000`
- Health check: `http://localhost:4000/healthz`
- PostgreSQL/PostGIS: `localhost:5432`
- pgAdmin: `http://localhost:5050`
- Redis: internal container network at `redis://redis:6379/0`

pgAdmin default login:

- Email: `admin@example.com`
- Password: `admin`

Stop the stack:

```bash
npm run docker:down:dev
```

### Option 2: Run without Docker

Use this when PostgreSQL/PostGIS is already installed locally or managed elsewhere.

Prerequisites:

- Node.js 20+
- PostgreSQL with PostGIS enabled
- Redis optional

1. Copy the env template:

```bash
cp .env.example .env
```

2. Update `.env`.

Recommended local values:

```env
PORT=4000
APP_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/property_valuation?schema=public
REDIS_URL=redis://localhost:6379/0
```

If you keep the template defaults, the API will run on port `3600`.

3. Install dependencies:

```bash
npm install
```

4. Generate the Prisma client:

```bash
npm run prisma:generate
```

5. Run development migrations:

```bash
npm run prisma:migrate:dev
```

6. Optional: seed the database:

```bash
npm run prisma:seed
```

7. Start the API in watch mode:

```bash
npm run dev
```

## Deployment

### Option 1: Docker Compose production

Use this when deploying the API with Docker outside Render.

Files used:

- `docker-compose.prod.yml`
- `Dockerfile.prod`
- `.env.production`

Before starting:

- Replace placeholder values in `.env.production` with real secrets
- Do not leave unresolved `${...}` placeholders in `.env.production`
- Set public URLs for `APP_URL`, `FRONTEND_URL`, and `CORS_ORIGINS`
- Configure your email provider
- Add Cloudflare R2 and Google keys if those integrations are enabled

Start the production stack:

```bash
npm run docker:prod
```

Or directly:

```bash
docker-compose -f docker-compose.prod.yml up --build -d
```

The production container runs `prisma migrate deploy` before starting the API.

Services:

- API: `http://localhost:4000`
- PostgreSQL: internal container service
- Redis: internal container service

Stop the stack:

```bash
npm run docker:down:prod
```

### Option 2: Deploy to Render

This project includes `render.yaml` for Render Blueprint deployment.

Render provisions:

- Web service: `property-valuation-api`
- PostgreSQL database: `property-valuation-db`

Build command:

```bash
npm ci --include=dev && npm run build && npx prisma migrate deploy && npm run deploy:seed
```

Start command:

```bash
npm run start
```

Values already handled by `render.yaml`:

- `DATABASE_URL`
- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `TZ`
- `NODE_ENV`
- `TRUST_PROXY`

Values you still need to set in Render:

- `CORS_ORIGINS`
- `APP_URL`
- `FRONTEND_URL`
- `EMAIL_PROVIDER`
- `EMAIL_FROM`
- `EMAIL_VERIFY_LINK_TARGET`
- `RESEND_API_KEY` when using `resend`
- `EMAIL_USER` and `EMAIL_PASS` when using `smtp`

Optional deployment variables:

- `RUN_SEED=true` when you intentionally want seeding during deploy
- Cloudflare R2 credentials
- Google Maps and geocoding credentials

After deployment, verify:

```bash
curl https://your-domain/healthz
```

## Scripts

- `npm run dev` - start the API in watch mode
- `npm run build` - compile TypeScript to `dist`
- `npm run start` - run the production build
- `npm run prisma:generate` - generate Prisma client
- `npm run prisma:migrate:dev` - run development migrations
- `npm run prisma:migrate:deploy` - apply production migrations
- `npm run prisma:migrate:reset` - reset the database
- `npm run prisma:seed` - seed the database
- `npm run prisma:studio` - open Prisma Studio
- `npm run docker:dev` - start the development Docker stack
- `npm run docker:down:dev` - stop the development Docker stack
- `npm run docker:prod` - start the production Docker stack
- `npm run docker:down:prod` - stop the production Docker stack
- `npm run generate:secrets` - generate JWT-style secrets for env setup

## Environment Variables

Use `.env.example` as the baseline for local setup.

### Required in all environments

```env
DATABASE_URL=postgresql://...
JWT_SECRET=replace-with-secure-random-secret
JWT_REFRESH_SECRET=replace-with-secure-random-refresh-secret
```

### Core app settings

```env
TZ=Asia/Phnom_Penh
NODE_ENV=development
PORT=3600
TRUST_PROXY=1
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
APP_URL=http://localhost:3600
FRONTEND_URL=http://localhost:3000
```

### Database

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres123
POSTGRES_DB=property_valuation
```

### Cache and Redis

```env
REDIS_URL=redis://localhost:6379/0
REDIS_CONNECT_TIMEOUT_MS=2000
CACHE_ADDRESS_TTL_SECONDS=86400
CACHE_PROPERTY_TYPE_TTL_SECONDS=3600
CACHE_PROPERTY_STATS_TTL_SECONDS=60
CACHE_GEOCODE_TTL_SECONDS=1209600
```

### Auth

```env
JWT_EXPIRES_IN=30m
JWT_REFRESH_EXPIRES_IN=14d
```

### Email

SMTP mode:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
EMAIL_USER=your-email@example.com
EMAIL_PASS=your-app-password
EMAIL_FROM="CamTop <your-email@example.com>"
EMAIL_VERIFY_LINK_TARGET=backend
```

Resend mode:

```env
EMAIL_PROVIDER=resend
EMAIL_FROM="CamTop <no-reply@yourdomain.com>"
EMAIL_VERIFY_LINK_TARGET=backend
RESEND_API_KEY=re_xxxxxxxxx
```

### Optional integrations

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_ACCESS_KEY_ID`
- `CLOUDFLARE_SECRET_ACCESS_KEY`
- `CLOUDFLARE_BUCKET_NAME`
- `CLOUDFLARE_BUCKET_REGION`
- `CLOUDFLARE_R2_PUBLIC_URL`
- `GOOGLE_GEOCODING_API_KEY`
- `GOOGLE_MAP_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_IDS`

## Database and Admin Tools

Open Prisma Studio locally:

```bash
npm run prisma:studio
```

Open Prisma Studio inside Docker dev:

```bash
docker-compose -f docker-compose.dev.yml exec api npm run prisma:studio
```

Run the seed locally:

```bash
npm run prisma:seed
```

Run the seed inside Docker dev:

```bash
docker-compose -f docker-compose.dev.yml exec api npm run prisma:seed
```

## API Route Groups

All routes are mounted under `/api`.

- `/api/auth`
- `/api/users`
- `/api/roles`
- `/api/permissions`
- `/api/properties`
- `/api/property-address`
- `/api/propertytype`
- `/api/property-valuations`
- `/api/property-indicativeValuation`
- `/api/notifications`
- `/api/audit`

## Maintenance

Cleanup old audit logs:

```bash
curl -X DELETE "http://localhost:4000/api/audit/cleanup?days=365" \
  -H "Authorization: Bearer <your_admin_token>"
```

## License

ISC
