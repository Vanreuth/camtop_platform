# Property Valuation System

Frontend dashboard for CamTop Property Valuation. This app provides the user interface for authentication, property management, valuation workflows, indicative valuation workflows, reporting, settings, and map-based property tools.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- next-intl
- TanStack Query
- Axios
- Radix UI

## Main Capabilities

- Login, registration, password reset, and email verification
- Role-based dashboard experience
- Property listing and detail pages
- Property valuation workflow
- Indicative valuation create, edit, detail, PDF, and export flows
- Map and location-based property tools
- Multi-language UI with `en` and `kh`

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create `.env.local` with values like:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=your-browser-key
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

The app expects the backend API to be reachable at `NEXT_PUBLIC_API_URL`.

### 3. Start the app

```bash
npm run dev
```

Default local URL:

- `http://localhost:3000`

## Scripts

- `npm run dev` - Start Next.js in development mode
- `npm run build` - Create a production build
- `npm run start` - Start the production server
- `npm run lint` - Lint the source directory

## Routing and Locales

This app uses locale-based routing with:

- `en`
- `kh`

Examples:

- `http://localhost:3000/en/login`
- `http://localhost:3000/en/dashboard`

## Backend Dependency

For most features, the frontend requires the API project to be running.

Recommended local pairing:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`
- API base URL env: `http://localhost:4000/api`

## Project Structure

```text
property_valution_system
├── src/app
├── src/components
├── src/hooks
├── src/lib
├── src/types
└── src/utils
```

## Notable App Areas

- `src/app/[locale]/(auth)` - Auth pages
- `src/app/[locale]/(dashboard)` - Main dashboard pages
- `src/app/messages` - Translation files
- `src/lib/api.ts` - Shared Axios client and token refresh logic

## Notes

- The frontend sends authenticated requests with Axios and refresh-cookie support.
- If the backend port changes, update `NEXT_PUBLIC_API_URL` to match.
- Google Maps features require a valid browser API key.
