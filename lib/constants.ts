// ─── FX Conversion Rates (base: INR) ───────────────────────────────────────
// Rates as of June 2025. Update periodically via config or env if needed.
export const FX_RATES: Record<string, number> = {
  INR: 1,
  USD: 83.5,
  GBP: 106.0,
  EUR: 90.0,
}

// ─── Pagination ─────────────────────────────────────────────────────────────
export const DEFAULT_PAGE_SIZE = 25
export const MAX_PAGE_SIZE = 100

// ─── Duplicate Detection Window ──────────────────────────────────────────────
export const DUPLICATE_WINDOW_HOURS = 48
export const DUPLICATE_SALARY_TOLERANCE = 0.1 // ±10%

// ─── Confidence Score Floors ─────────────────────────────────────────────────
export const CONFIDENCE_FLOOR_CONTRIBUTOR = 0.9
export const CONFIDENCE_FLOOR_SCRAPED = 0.5
export const CONFIDENCE_FLOOR_AI = 0.6
export const CONFIDENCE_REVIEW_THRESHOLD = 0.4 // Below this → flag for review

// ─── Valid Levels (mirrors Prisma enum) ──────────────────────────────────────
export const VALID_LEVELS = [
  'L3', 'L4', 'L5', 'L6',
  'SDE_I', 'SDE_II', 'SDE_III',
  'STAFF', 'PRINCIPAL', 'IC4', 'IC5',
] as const

export type LevelType = typeof VALID_LEVELS[number]

// ─── Valid Currencies (mirrors Prisma enum) ───────────────────────────────────
export const VALID_CURRENCIES = ['INR', 'USD', 'GBP', 'EUR'] as const
export type CurrencyType = typeof VALID_CURRENCIES[number]

// ─── Valid Sources (mirrors Prisma enum) ─────────────────────────────────────
export const VALID_SOURCES = ['CONTRIBUTOR', 'SCRAPED', 'AI_INFERRED'] as const
export type SourceType = typeof VALID_SOURCES[number]
