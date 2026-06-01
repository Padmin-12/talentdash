import { VALID_LEVELS, VALID_CURRENCIES, VALID_SOURCES } from './constants'
import { z } from 'zod'

// ─── Ingest Salary Payload Schema ─────────────────────────────────────────────

export const IngestSalarySchema = z.object({
  company: z
    .string()
    .min(2, 'Company name must be at least 2 characters')
    .max(200, 'Company name must be under 200 characters'),

  role: z
    .string()
    .min(2, 'Role must be at least 2 characters')
    .max(200, 'Role must be under 200 characters'),

  level: z.enum(VALID_LEVELS, {
    error: `Level must be one of: ${VALID_LEVELS.join(', ')}`,
  }),

  location: z
    .string()
    .min(2, 'Location must be at least 2 characters')
    .max(100, 'Location must be under 100 characters'),

  currency: z.enum(VALID_CURRENCIES, {
    error: `Currency must be one of: ${VALID_CURRENCIES.join(', ')}`,
  }),

  experience_years: z
    .number()
    .int('Experience years must be an integer')
    .gt(0, 'Experience years must be greater than 0')
    .lt(51, 'Experience years must be less than 51'),

  base_salary: z
    .number()
    .gt(0, 'Base salary must be greater than 0'),

  bonus: z.number().min(0, 'Bonus cannot be negative').optional().default(0),

  stock: z.number().min(0, 'Stock cannot be negative').optional().default(0),

  // Client-submitted total_compensation is ALWAYS stripped and recomputed.
  // We accept it here but immediately discard it.
  total_compensation: z.number().optional(),

  source: z.enum(VALID_SOURCES, {
    error: `Source must be one of: ${VALID_SOURCES.join(', ')}`,
  }),

  confidence_score: z
    .number()
    .min(0.0, 'Confidence score must be >= 0.0')
    .max(1.0, 'Confidence score must be <= 1.0'),
})

export type IngestSalaryPayload = z.infer<typeof IngestSalarySchema>

// ─── GET /api/salaries Query Params Schema ────────────────────────────────────

export const SalaryQuerySchema = z.object({
  company: z.string().optional(),
  role: z.string().optional(),
  level: z.enum(VALID_LEVELS).optional(),
  location: z.string().optional(),
  currency: z.enum(VALID_CURRENCIES).optional(),
  sort: z
    .enum(['total_comp_desc', 'total_comp_asc', 'date_desc'])
    .optional()
    .default('total_comp_desc'),
  page: z.coerce
    .number()
    .int()
    .min(1, 'Page must be >= 1')
    .optional()
    .default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'Limit must be >= 1')
    .optional()
    .default(25)
    .transform((v) => Math.min(v, 100)), // silently cap at 100 — never reject with 400
})

export type SalaryQuery = z.infer<typeof SalaryQuerySchema>

// ─── Formatted error helper ───────────────────────────────────────────────────

export function formatZodError(error: z.ZodError) {
  const firstIssue = error.issues[0]
  return {
    error: true,
    field: firstIssue.path.join('.') || 'unknown',
    message: firstIssue.message,
  }
}
