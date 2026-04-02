# Property Valuation API

Backend service for CamTop Property Valuation. It provides authentication, user and role management, property records, full valuations, indicative valuations, notifications, exports, and supporting geolocation/file-upload services.

## Stack

- Node.js + TypeScript
- Express 5
- Prisma ORM
- PostgreSQL + PostGIS
- Zod validation
- Multer file uploads

## Main Capabilities

- Auth and refresh-token flow
- Users, roles, and permissions
- Property CRUD and address/location data
- Full property valuations
- Indicative valuations with PDF and Excel export
- Notifications and audit logs
- Cloudflare R2 file storage support
- Google geocoding integration

## Important URLs

- Base URL: `http://localhost:4000`
- API prefix: `http://localhost:4000/api`
- Health check: `http://localhost:4000/healthz`

## Local Development

### Option 1: Docker Compose (recommended)

```bash
docker-compose -f docker-compose.dev.yml up --build
```

This starts:

- API on `http://localhost:4000`
- PostgreSQL/PostGIS on `localhost:5432`
- pgAdmin on `http://localhost:5050`

pgAdmin default login:

- Email: `admin@example.com`
- Password: `admin`

### Option 2: Run without Docker

1. Copy env values:

```bash
cp .env.example .env
```

2. Update `.env` so the API and frontend use matching local URLs.

Recommended local values:

```env
PORT=4000
APP_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/property_valuation?schema=public
```

3. Install dependencies and generate Prisma client:

```bash
npm install
npm run prisma:generate
```

4. Run migrations:

```bash
npm run prisma:migrate:dev
```

5. Start the API:

```bash
npm run dev
```

## Scripts

- `npm run dev` - Start the API in watch mode
- `npm run build` - Compile TypeScript to `dist`
- `npm run start` - Run the production build
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate:dev` - Run development migrations
- `npm run prisma:migrate:deploy` - Apply production migrations
- `npm run prisma:migrate:reset` - Reset the database
- `npm run prisma:seed` - Seed the database
- `npm run prisma:studio` - Open Prisma Studio
- `npm run docker:dev` - Start the development Docker stack
- `npm run docker:prod` - Start the production Docker stack

## Environment Variables

Use `.env.example` as the starting point.

### Core

```env
TZ=Asia/Phnom_Penh
NODE_ENV=development
PORT=4000
TRUST_PROXY=1
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
APP_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000
```

### Database

```env
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/property_valuation?schema=public
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres123
POSTGRES_DB=property_valuation
```

### Auth

```env
JWT_SECRET=replace-with-secure-random-secret
JWT_REFRESH_SECRET=replace-with-secure-random-refresh-secret
JWT_EXPIRES_IN=30m
JWT_REFRESH_EXPIRES_IN=14d
```

### Optional Integrations

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

## Database and Admin Tools

Open Prisma Studio:

```bash
npm run prisma:studio
```

When using Docker:

```bash
docker-compose -f docker-compose.dev.yml exec api npm run prisma:studio
```

Run seed:

```bash
npm run prisma:seed
```

When using Docker:

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

## Deploy to Render

This project includes `render.yaml` for Render Blueprint deployment.

### Render creates

- Web service: `property-valuation-api`
- PostgreSQL database: `property-valuation-db`

### Build command

```bash
npm ci --include=dev && npm run build && npx prisma migrate deploy && npm run deploy:seed
```

### Start command

```bash
npm run start
```

### Required Render values

- `CORS_ORIGINS`
- `APP_URL`
- `FRONTEND_URL`
- `EMAIL_PROVIDER`
- `EMAIL_FROM`
- `EMAIL_VERIFY_LINK_TARGET`
- `RESEND_API_KEY` if using `resend`

Optional deployment variables include Cloudflare R2 and Google integration settings.

## Maintenance

Cleanup old audit logs:

```bash
curl -X DELETE "http://localhost:4000/api/audit/cleanup?days=365" \
  -H "Authorization: Bearer <your_admin_token>"
```

## License

ISC
