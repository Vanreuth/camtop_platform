# Property Valuation API

## Deploy To Render (Production)

This repository now includes `render.yaml` for Render Blueprint deploys.

### 1) Prepare your repo

- Commit and push all changes (including `render.yaml`).
- In Render, click **New** -> **Blueprint** and select this repo.

### 2) What Render will create

- One web service: `property-valuation-api`
- One PostgreSQL database: `property-valuation-db`

### 3) Required environment values in Render

Set these before first production deploy:

- `CORS_ORIGINS` (example: `https://your-frontend-domain.com`)
- `APP_URL` (your backend public URL, example: `https://property-valuation-api.onrender.com`)
- `FRONTEND_URL` (your frontend public URL)
- `EMAIL_PROVIDER` (`resend` for Render free tier)
- `EMAIL_FROM` (example: `CamTop <no-reply@yourdomain.com>`)
- `EMAIL_LOGO_URL` (optional logo URL used in verification email header)
- `EMAIL_VERIFY_LINK_TARGET` (`backend` recommended; `frontend` only if your frontend verify page calls backend API)
- `RESEND_API_KEY`

If you use these integrations, also set:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_ACCESS_KEY_ID`
- `CLOUDFLARE_SECRET_ACCESS_KEY`
- `CLOUDFLARE_BUCKET_NAME`
- `CLOUDFLARE_R2_PUBLIC_URL`
- `GOOGLE_GEOCODING_API_KEY`
- `GOOGLE_CLIENT_ID` (must match frontend `NEXT_PUBLIC_GOOGLE_CLIENT_ID`)
- `GOOGLE_CLIENT_IDS` (optional comma-separated allowed audiences)

### 4) Migrations and PostGIS

On each deploy, Render runs:

```bash
npm ci --include=dev && npm run build && npx prisma migrate deploy && npm run deploy:seed
```

This command:

- Installs dependencies
- Builds TypeScript (`npm run build`)
- Runs Prisma migrations (`npx prisma migrate deploy`)
- Runs optional seed script (`RUN_SEED=true`)

### 5) Health check

Render health check path is:

- `/healthz`

### 6) Email on Render free tier (HTTPS API)

Free web services cannot use SMTP ports (25/465/587), so use API mode:

```env
EMAIL_PROVIDER=resend
EMAIL_FROM=CamTop <no-reply@yourdomain.com>
EMAIL_LOGO_URL=https://camtopproperty.site/logo/camtop_logo.svg
EMAIL_VERIFY_LINK_TARGET=backend
RESEND_API_KEY=re_xxxxxxxxx
```

---


# Prisma debug (optional)
DEBUG=prisma:*

3️⃣ Start services
docker-compose up --build

This will:

Run PostgreSQL on localhost:5432

Run API on localhost:4000

Run Prisma Studio on localhost:5555

Run pgAdmin on http://localhost:5050

Email: admin@example.com
Password: admin

🔎 pgAdmin (Database Viewer)

- Open: http://localhost:5050
- Login with `PGADMIN_DEFAULT_EMAIL` / `PGADMIN_DEFAULT_PASSWORD`
- Add Server:
  - Host name/address: `db` (when pgAdmin runs in Docker)
  - Port: `5432`
  - Username: `${DB_USER}` (or your `POSTGRES_USER`)
  - Password: `${DB_PASSWORD}` (or your `POSTGRES_PASSWORD`)

If you use pgAdmin installed on your PC (not the Docker service), connect to:
- Host: `localhost`
- Port: `5432`


Enable SQL query logging by adding this to .env or docker-compose.yml:

DEBUG=prisma:*
🗃️ Database Management
Run migrations

docker-compose -f docker-compose.dev.yml exec api npx prisma migrate dev
or 

docker-compose -f docker-compose.dev.yml exec api npm run prisma:migrate:dev


Open Prisma Studio
docker-compose -f docker-compose.dev.yml exec api npx prisma studio

or 
docker-compose -f docker-compose.dev.yml exec api npm run prisma:studio


Prisma Studio runs on http://localhost:5555
.

Run database seed

docker-compose -f docker-compose.dev.yml exec api npm run prisma:seed

or

docker-compose -f docker-compose.dev.yml exec api npm run prisma:seed

Reset migrate and restart seed 

docker-compose -f docker-compose.dev.yml exec api npx prisma migrate reset

or 

docker-compose -f docker-compose.dev.yml exec api npm run prisma:migrate:reset

*** When change schema change and error in seed :

In docker:
docker-compose -f docker-compose.dev.yml exec api npm run prisma:migrate:dev

docker-compose -f docker-compose.dev.yml exec api npx prisma generate

docker-compose -f docker-compose.dev.yml exec api npm run prisma:seed

The solution:
bash# 1. On your LOCAL machine (outside Docker), regenerate Prisma Client
npx prisma generate


🧹 Maintenance
Cleanup old audit logs
curl -X DELETE "http://localhost:4000/audit/cleanup?days=365" \
     -H "Authorization: Bearer <your_admin_token>"

📜 License

MIT License


One-to-One

Property ↔ TitleDocument

Property ↔ DataSource

Property ↔ PropertyPhoto

Property ↔ BuildingDetail

Property ↔ PropertyAddress

Property ↔ PropertyLocation

One-to-Many

RecordType → PropertyType

PropertyType → Property

PropertyType → BuildingSubtype

BuildingSubtype → BuildingDetail

Province → District → Commune → Village → PropertyAddress


# Property Valuation Workflow Documentation

## 📊 Overview

This system implements a comprehensive property valuation workflow with three primary valuation approaches, each producing a specific type of value:

| Valuation Method | Value Type Produced | Field Name | Description |
|------------------|---------------------|------------|-------------|
| **Sales Comparison Approach** | Market Value | `marketValue` | Value based on comparable sales in the market |
| **Income Approach** | Investment Value | `investmentValue` | Value based on income generation potential (rental income) |
| **Cost Approach** | Fair Value | `fairValue` | Value based on replacement cost minus depreciation |

## 🔄 Valuation Workflow

### Workflow States

```
DRAFT → PENDING_REVIEW → IN_REVIEW → APPROVED / REJECTED → ARCHIVED
```

### State Descriptions

1. **DRAFT**: Initial valuation created by valuer
2. **PENDING_REVIEW**: Submitted for review
3. **IN_REVIEW**: Being reviewed by approver
4. **APPROVED**: Valuation approved and finalized
5. **REJECTED**: Valuation rejected with reason
6. **ARCHIVED**: Old/superseded valuation

## 💰 Valuation Approaches Explained

### 1. Sales Comparison Approach → Market Value

**When to Use:**
- Properties with active comparable sales
- Residential properties (houses, condos, apartments)
- Land with recent transactions
- Commercial properties with comparable sales

**Method:**
- Compare subject property with similar properties recently sold
- Adjust for differences (location, size, condition, features)
- Calculate market value based on comparables

**Database Fields:**
```typescript
{
  valuationMethod: "SALES_COMPARISON_APPROACH",
  marketValue: 250000.00,
  landUnitPrice: 500.00,  // Price per sqm for land
  buildingUnitPrice: 800.00  // Price per sqm for building
}
```

**Example API Request:**
```json
{
  "propertyId": 1,
  "valuationMethod": "SALES_COMPARISON_APPROACH",
  "marketValue": 250000.00,
  "landUnitPrice": 500.00,
  "buildingUnitPrice": 800.00,
  "confidenceLevel": "HIGH",
  "valuedBy": 1,
  "valuerLicense": "VAL-2024-001",
  "notes": "Based on 3 comparable sales within 1km radius",
  "status": "DRAFT"
}
```

### 2. Income Approach → Investment Value

**When to Use:**
- Income-producing properties (rental properties)
- Commercial properties (offices, retail spaces)
- Multi-unit residential buildings
- Agricultural land with crop income

**Method:**
- Calculate Net Operating Income (NOI)
- Apply capitalization rate
- Consider rental yields and income potential
- Factor in vacancy rates and operating expenses

**Database Fields:**
```typescript
{
  valuationMethod: "INCOME_APPROACH",
  investmentValue: 300000.00,
  rentalValue: 2500.00,  // Monthly rental income
  confidenceLevel: "MEDIUM"
}
```

**Formula:**
```
Investment Value = Annual Net Income / Capitalization Rate

Example:
Monthly Rent: $2,500
Annual Income: $30,000
Cap Rate: 10%
Investment Value = $30,000 / 0.10 = $300,000
```

**Example API Request:**
```json
{
  "propertyId": 2,
  "valuationMethod": "INCOME_APPROACH",
  "investmentValue": 300000.00,
  "rentalValue": 2500.00,
  "confidenceLevel": "MEDIUM",
  "valuedBy": 1,
  "valuerLicense": "VAL-2024-001",
  "notes": "Based on current rental income and 10% cap rate",
  "status": "DRAFT"
}
```

### 3. Cost Approach → Fair Value

**When to Use:**
- New or recently constructed properties
- Special-use properties (schools, hospitals, factories)
- Properties with limited comparable sales
- Insurance purposes

**Method:**
- Calculate land value (vacant land value)
- Add building replacement cost
- Subtract depreciation (physical, functional, external)
- Result is fair value

**Database Fields:**
```typescript
{
  valuationMethod: "COST_APPROACH",
  fairValue: 280000.00,
  landUnitPrice: 500.00,
  buildingUnitPrice: 1200.00,  // Replacement cost per sqm
  confidenceLevel: "HIGH"
}
```

**Formula:**
```
Fair Value = Land Value + (Replacement Cost - Depreciation)

Example:
Land: 1,000 sqm × $500 = $500,000
Building: 150 sqm × $1,200 = $180,000
Depreciation: 20% = $36,000
Fair Value = $500,000 + ($180,000 - $36,000) = $644,000
```

**Example API Request:**
```json
{
  "propertyId": 3,
  "valuationMethod": "COST_APPROACH",
  "fairValue": 644000.00,
  "landUnitPrice": 500.00,
  "buildingUnitPrice": 1200.00,
  "confidenceLevel": "HIGH",
  "valuedBy": 1,
  "valuerLicense": "VAL-2024-001",
  "notes": "New construction, depreciation 20%",
  "status": "DRAFT"
}
```

## 📋 Complete Valuation Fields Reference

### Primary Valuation Values

```typescript
interface PropertyValuation {
  // Pricing Information
  listPrice?: number;         // Asking/listing price
  landUnitPrice?: number;     // Price per sqm for land
  buildingUnitPrice?: number; // Price per sqm for building
  
  // Approach-Specific Values
  marketValue?: number;       // Sales Comparison → Market Value
  investmentValue?: number;   // Income Approach → Investment Value
  rentalValue?: number;       // Monthly rental income
  fairValue?: number;         // Cost Approach → Fair Value
  
  // Other Values
  assessedValue?: number;     // Government assessed value
  forcedSaleValue?: number;   // Auction/forced sale value
  insuranceValue?: number;    // Insurance replacement value
}
```

## 🔐 Approval Workflow

### Step-by-Step Process

#### 1. Create Draft Valuation (Valuer)

```http
POST /api/valuations
Authorization: Bearer {valuer_token}
```

```json
{
  "propertyId": 1,
  "valuationMethod": "SALES_COMPARISON_APPROACH",
  "marketValue": 250000.00,
  "landUnitPrice": 500.00,
  "valuedBy": 2,
  "status": "DRAFT",
  "notes": "Initial valuation based on 3 comparables"
}
```

#### 2. Submit for Review (Valuer)

```http
PATCH /api/valuations/:id/submit
Authorization: Bearer {valuer_token}
```

```json
{
  "status": "PENDING_REVIEW"
}
```

#### 3. Start Review (Approver)

```http
PATCH /api/valuations/:id/start-review
Authorization: Bearer {approver_token}
```

```json
{
  "status": "IN_REVIEW"
}
```

#### 4a. Approve Valuation (Approver)

```http
PATCH /api/valuations/:id/approve
Authorization: Bearer {approver_token}
```

```json
{
  "status": "APPROVED",
  "approvedBy": 1,
  "approvedAt": "2024-10-16T10:30:00Z"
}
```

#### 4b. Reject Valuation (Approver)

```http
PATCH /api/valuations/:id/reject
Authorization: Bearer {approver_token}
```

```json
{
  "status": "REJECTED",
  "rejectionReason": "Comparables are not appropriate. Please use properties within 500m radius."
}
```

## 📊 Example Use Cases

### Use Case 1: Vacant Land Valuation (Sales Comparison)

```json
{
  "propertyId": 1,
  "propertyCode": "VL-PP-001",
  "valuationMethod": "SALES_COMPARISON_APPROACH",
  "marketValue": 500000.00,
  "landUnitPrice": 500.00,
  "landAreaSqm": 1000,
  "currency": "USD",
  "valuationDate": "2024-10-16",
  "validUntil": "2025-04-16",
  "valuedBy": 2,
  "valuerLicense": "VAL-2024-001",
  "valuerCompany": "ABC Valuation Services",
  "confidenceLevel": "HIGH",
  "notes": "3 comparable sales: \n- Property A: $520/sqm (800m distance)\n- Property B: $480/sqm (1.2km distance)\n- Property C: $505/sqm (600m distance)",
  "status": "DRAFT"
}
```

### Use Case 2: Commercial Building (Income Approach)

```json
{
  "propertyId": 4,
  "propertyCode": "OF-PP-001",
  "valuationMethod": "INCOME_APPROACH",
  "investmentValue": 1200000.00,
  "rentalValue": 10000.00,
  "listPrice": 1250000.00,
  "currency": "USD",
  "valuationDate": "2024-10-16",
  "validUntil": "2025-10-16",
  "valuedBy": 2,
  "valuerLicense": "VAL-2024-001",
  "confidenceLevel": "MEDIUM",
  "notes": "Capitalization approach:\n- Monthly rent: $10,000\n- Annual income: $120,000\n- Cap rate: 10%\n- Investment value: $1,200,000",
  "status": "PENDING_REVIEW"
}
```

### Use Case 3: New Construction (Cost Approach)

```json
{
  "propertyId": 3,
  "propertyCode": "CD-PP-001",
  "valuationMethod": "COST_APPROACH",
  "fairValue": 212500.00,
  "landUnitPrice": 500.00,
  "buildingUnitPrice": 2500.00,
  "landAreaSqm": 100,
  "buildingAreaSqm": 85,
  "currency": "USD",
  "valuationDate": "2024-10-16",
  "valuedBy": 2,
  "valuerLicense": "VAL-2024-001",
  "confidenceLevel": "HIGH",
  "notes": "Replacement cost method:\n- Land value: 100 sqm × $500 = $50,000\n- Building cost: 85 sqm × $2,500 = $212,500\n- Depreciation: 0% (new)\n- Total fair value: $212,500",
  "status": "APPROVED",
  "approvedBy": 1,
  "approvedAt": "2024-10-16T15:00:00Z"
}
```

## 🔗 Linking Valuations to Transactions

When a property is sold or rented, link the transaction to the valuation:

```json
{
  "transactionId": 1,
  "propertyId": 1,
  "valuationId": 5,
  "transactionType": "SALE",
  "transactionDate": "2024-10-20",
  "price": 250000.00,
  "partiesInvolved": "Seller: Mr. Sok Dara, Buyer: Mrs. Chan Sophea",
  "notes": "Transaction completed based on approved valuation"
}
```

## 📈 Valuation Comparison Example

For a comprehensive property analysis, you might perform all three approaches:

```json
{
  "propertyId": 5,
  "valuationDate": "2024-10-16",
  
  // Sales Comparison Approach
  "marketValue": 250000.00,
  
  // Income Approach
  "investmentValue": 275000.00,
  "rentalValue": 2000.00,
  
  // Cost Approach
  "fairValue": 240000.00,
  
  // Final Reconciliation
  "assessedValue": 255000.00,  // Weighted average
  "valuationMethod": "HYBRID_APPROACH",
  "notes": "Reconciled value using:\n- Market Value (40% weight): $250,000\n- Investment Value (30% weight): $275,000\n- Fair Value (30% weight): $240,000\n= Final Value: $255,000"
}
```

## 🎯 Best Practices

### 1. Choose the Right Approach

- **Residential**: Sales Comparison Approach
- **Rental Properties**: Income Approach
- **New Construction**: Cost Approach
- **Commercial**: Hybrid (multiple approaches)

### 2. Documentation

Always include detailed notes explaining:
- Comparable properties used
- Adjustments made
- Assumptions and limitations
- Data sources

### 3. Confidence Levels

Set appropriate confidence levels:
- **HIGH**: Recent comparables, good data quality
- **MEDIUM**: Limited data, some assumptions
- **LOW**: Scarce data, many assumptions

### 4. Valid Until Date

Set realistic validity periods:
- **Fast-moving markets**: 3-6 months
- **Stable markets**: 6-12 months
- **Specialized properties**: 6 months

## 📱 API Endpoints Summary

```
POST   /api/valuations                    - Create new valuation
GET    /api/valuations                    - List all valuations
GET    /api/valuations/:id                - Get valuation details
PUT    /api/valuations/:id                - Update valuation
DELETE /api/valuations/:id                - Delete valuation (draft only)

PATCH  /api/valuations/:id/submit         - Submit for review
PATCH  /api/valuations/:id/start-review   - Start review process
PATCH  /api/valuations/:id/approve        - Approve valuation
PATCH  /api/valuations/:id/reject         - Reject valuation
PATCH  /api/valuations/:id/archive        - Archive old valuation

GET    /api/properties/:id/valuations     - Get property valuations history
GET    /api/valuations/pending            - Get pending valuations
GET    /api/valuations/my-valuations      - Get current user's valuations
```

## 🔍 Query Examples

### Get Property with Latest Valuation

```http
GET /api/properties/1?include=valuations&latest=true
```

### Get Approved Valuations for a Property

```http
GET /api/valuations?propertyId=1&status=APPROVED
```

### Get Valuations by Method

```http
GET /api/valuations?valuationMethod=SALES_COMPARISON_APPROACH
```

### Get Pending Valuations for Approval

```http
GET /api/valuations?status=PENDING_REVIEW&valuedBy=2
```

---

## 🎓 Valuation Terminology

| Term | Definition |
|------|------------|
| **Market Value** | The estimated amount for which a property should exchange on the date of valuation |
| **Investment Value** | The value of a property to a particular investor based on their investment requirements |
| **Fair Value** | The price that would be received to sell an asset in an orderly transaction |
| **Assessed Value** | Value determined by tax authorities for taxation purposes |
| **Forced Sale Value** | The amount that could be obtained in a forced sale scenario |
| **Capitalization Rate** | The rate of return on a real estate investment property |
| **Net Operating Income (NOI)** | Income after operating expenses but before debt service |

---

This comprehensive valuation workflow ensures professional property valuations with proper documentation, approval processes, and alignment with international valuation standards.
