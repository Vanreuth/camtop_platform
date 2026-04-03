# CamTop Property Valuation

This workspace contains the backend API and the frontend dashboard used for property valuation, indicative valuation, authentication, role-based access, maps, and reporting.

## Projects

- `property_valution_api`
  Express + TypeScript + Prisma + PostgreSQL/PostGIS backend
- `property_valution_system`
  Next.js + React dashboard frontend

## Repository Structure

```text
.
├── property_valution_api
└── property_valution_system
```

## Quick Start

### 1. Start the API

Recommended local backend setup uses Docker:

```bash
cd property_valution_api
docker-compose -f docker-compose.dev.yml up --build
```

Default local URLs:

- API: `http://localhost:4000`
- Health check: `http://localhost:4000/healthz`
- PostgreSQL: `localhost:5432`
- pgAdmin: `http://localhost:5050`

### 2. Start the frontend

In a new terminal:

```bash
cd property_valution_system
npm install
npm run dev
```

Default frontend URL:

- App: `http://localhost:3000`

## Environment Notes

The frontend expects the backend API base URL from:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

The backend development Docker setup already runs on port `4000`, so this matches the frontend defaults.

## Project Documentation

Detailed setup, environment variables, and deployment notes are available in the project-specific READMEs:

- Backend setup and deployment: [property_valution_api/README.md](./property_valution_api/README.md)
- Frontend setup and development: [property_valution_system/README.md](./property_valution_system/README.md)
