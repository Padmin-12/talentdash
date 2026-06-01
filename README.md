# TalentDash — Backend

> Career intelligence platform. Compensation intelligence engine. Structured data → Comparable → Decision-ready.

## Live URL

> _Deployment in progress — will be updated here once Railway deploy is complete._

## What This Is

TalentDash backend: the data integrity and query layer for a salary intelligence platform. Every salary record is validated, company-normalised, deduplicated, and stored with a server-computed `total_compensation`. The frontend and AI pipeline both depend on this layer.

**Four API endpoints:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/ingest-salary` | POST | Validate → normalise → dedup → store |
| `/api/salaries` | GET | Filtered, paginated, sorted salary query |
| `/api/companies/:slug` | GET | Company detail with median TC + level distribution |
| `/api/compare` | GET | Two salary records side-by-side with delta |

---

## Run Locally in Under 5 Minutes

### Prerequisites
- Node.js 18+
- A Neon PostgreSQL project ([neon.tech](https://neon.tech))

### 1. Clone and install
```bash
git clone https://github.com/Padmin-12/talentdash.git
cd talentdash
npm install
```

### 2. Set environment variables
```bash
cp .env.example .env
```

Edit `.env` and fill in your Neon connection strings:
```env
# Pooled connection (app queries)
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Direct connection (Prisma migrations — bypasses pooler)
DIRECT_URL="postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"

NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

### 3. Run migrations
```bash
npx prisma migrate deploy
```

### 4. Seed the database (58 records, 12 companies)
```bash
npx prisma db seed
```

### 5. Start the dev server
```bash
npm run dev
```

API is live at `http://localhost:3000/api/`

---

## API Reference

### POST /api/ingest-salary
Full validation + normalisation pipeline.

**Request body:**
```json
{
  "company": "Google India",
  "role": "Software Engineer",
  "level": "L5",
  "location": "Bengaluru",
  "currency": "INR",
  "experience_years": 6,
  "base_salary": 5500000,
  "bonus": 700000,
  "stock": 2500000,
  "source": "CONTRIBUTOR",
  "confidence_score": 0.9
}
```

**Validation rules (in order):**
1. All required fields present
2. `level` must be one of: `L3 L4 L5 L6 SDE_I SDE_II SDE_III STAFF PRINCIPAL IC4 IC5`
3. `experience_years`: integer, 1–50
4. `base_salary`: > 0
5. `confidence_score`: 0.0–1.0
6. `currency`: `INR USD GBP EUR`

**CRITICAL:** `total_compensation` is always stripped from input and recomputed server-side as `base + bonus + stock`. Never trust the client value.

**Responses:**
- `201 Created` — stored record with computed `total_compensation`
- `400 Bad Request` — `{ "error": true, "field": "level", "message": "Level must be one of..." }`
- `409 Conflict` — duplicate record within 48h window

---

### GET /api/salaries
```
GET /api/salaries?company=amazon&level=L5&location=Bengaluru&sort=total_comp_desc&page=1&limit=25
```

**Query params:**
| Param | Type | Notes |
|---|---|---|
| `company` | string | Case-insensitive partial match |
| `role` | string | Case-insensitive partial match |
| `level` | enum | Exact match |
| `location` | string | Case-insensitive partial match |
| `currency` | enum | Exact match |
| `sort` | enum | `total_comp_desc` (default) \| `total_comp_asc` \| `date_desc` |
| `page` | int | Default 1 |
| `limit` | int | Default 25, **silently capped at 100** |

**Response:**
```json
{
  "data": [...],
  "meta": { "total": 312, "page": 1, "limit": 25, "totalPages": 13 }
}
```

**Cache-Control:** `s-maxage=300, stale-while-revalidate=3600`

---

### GET /api/companies/:slug
```
GET /api/companies/amazon
```

**Response includes:**
- Company metadata
- `median_total_compensation` — true P50 statistical median (not average)
- `tc_range` — min and max
- `level_distribution` — `{ "SDE_I": 2, "SDE_II": 3, ... }`
- `salaries` — full list sorted by TC descending

**Cache-Control:** `s-maxage=3600, stale-while-revalidate=86400`

**404:** `{ "error": true, "message": "Company not found" }`

---

### GET /api/compare
```
GET /api/compare?s1=<uuid>&s2=<uuid>
```

**Response:**
```json
{
  "record1": { ... },
  "record2": { ... },
  "delta": {
    "base_delta": "400000",
    "bonus_delta": "-50000",
    "stock_delta": "1000000",
    "tc_delta": "1350000",
    "experience_delta": 2
  },
  "winner": "record1"
}
```

Delta = record1 − record2. Positive = record1 is higher.

**Errors:**
- `400` — identical IDs (`s1 === s2`)
- `400` — missing `s1` or `s2`
- `404` — either ID not found (specifies which)

---

## Architecture Decisions

### Why static vs ISR vs dynamic per page type
| Page | Strategy | Reason |
|---|---|---|
| `/api/salaries` | Cache-Control: 5min CDN | Data changes hourly, not per-request |
| `/api/companies/:slug` | Cache-Control: 1hr CDN | Company data very stable |
| `/api/compare` | No cache | User-specific UUIDs, cannot be predicted |
| `/api/ingest-salary` | No cache | Write endpoint |

### Why page-based pagination (not cursor)
Page-based is the right choice here because: (1) the total record count is needed for the "Showing X–Y of Z records" UI, which cursor pagination cannot provide efficiently; (2) salary table pages are SEO-linked (`/salaries?page=2`), requiring stable offsets; (3) the dataset at MVP scale (< 1M rows) does not have the keyset performance problems that justify cursor complexity.

### Company normalisation: two-layer approach
Layer 1 (programmatic): lowercase → strip legal suffixes (`pvt ltd`, `inc`, `llc`, `technologies`, etc.) → strip punctuation → collapse spaces. Layer 2 (alias table): `aliases.json` maps known variants that rules can't resolve (`"tata consultancy" → "tcs"`). Alias table is a separate file so it can be updated without touching normalisation logic.

### Why `total_compensation` is always server-side
A scraper or malicious contributor could submit inflated TCs to manipulate medians and leaderboards. Stripping and recomputing at the API boundary is the only safe design. This is enforced in: ingest endpoint, seed script, and there is a DB CHECK constraint ensuring `total_compensation > 0`.

### What I did NOT build and why
- **BullMQ / Upstash Redis queue** — 72h window. Core CRUD is higher priority than job infrastructure. Queue is Phase 2.
- **ISR revalidation triggers** — POST /ingest-salary does not yet call `revalidatePath`. Would add after deployment is stable.
- **Full-text search (tsvector)** — Covered by Prisma `mode: 'insensitive'` ILIKE for MVP. Typesense is Phase 2.

### Cache-Control TTL rationale
- `GET /api/salaries` → `s-maxage=300, stale-while-revalidate=3600`: Salary data refreshes at most every few minutes. 5min CDN cache handles viral traffic spikes. SWR means users never wait for a cache miss.
- `GET /api/companies/:slug` → `s-maxage=3600, stale-while-revalidate=86400`: Company metadata barely changes. 1hr cache means a company page served 10,000 times/hr hits Neon at most once per hour.

---

## Database Schema

**Two models:** `Company` (one) → `Salary` (many)

**Indexes:**
- `(company_id, level, location)` — primary filter path
- `(total_compensation)` — sort path
- `(submitted_at)` — recency sort
- `(location, level)` — geo-level filter

**DB-level CHECK constraints** (migration `20260601103645`):
- `experience_years > 0 AND < 51`
- `base_salary > 0`
- `confidence_score >= 0.0 AND <= 1.0`
- `bonus >= 0`, `stock >= 0`, `total_compensation > 0`

---

## Tech Stack
- **Framework:** Next.js 16 (App Router)
- **Database:** Neon PostgreSQL (serverless)
- **ORM:** Prisma 7
- **Validation:** Zod 4
- **Adapter:** @prisma/adapter-pg
- **Deployment:** Railway
