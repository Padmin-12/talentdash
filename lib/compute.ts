// ─── TC Recomputation ─────────────────────────────────────────────────────────

/**
 * CRITICAL: total_compensation is ALWAYS computed here, never trusted from input.
 * base + (bonus ?? 0) + (stock ?? 0)
 */
export function computeTotalCompensation(
  base_salary: number,
  bonus: number = 0,
  stock: number = 0,
): bigint {
  return BigInt(Math.round(base_salary)) +
    BigInt(Math.round(bonus)) +
    BigInt(Math.round(stock))
}

// ─── Statistical Median ───────────────────────────────────────────────────────

/**
 * Returns the true P50 statistical median.
 * NOT an average — the exact middle value when sorted.
 *
 * - Odd count  → middle element
 * - Even count → average of two middle elements
 * - Empty array → null
 */
export function computeMedian(values: bigint[]): bigint | null {
  if (values.length === 0) return null

  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const mid = Math.floor(sorted.length / 2)

  if (sorted.length % 2 !== 0) {
    return sorted[mid]
  } else {
    // Average of two middle values (for BigInt, use integer division)
    return (sorted[mid - 1] + sorted[mid]) / 2n
  }
}

// ─── Delta Computation ────────────────────────────────────────────────────────

export interface SalaryDelta {
  base_delta: bigint
  bonus_delta: bigint
  stock_delta: bigint
  tc_delta: bigint
  experience_delta: number
}

/**
 * Delta = record1_value - record2_value
 * Positive = record1 is higher
 * Negative = record2 is higher
 */
export function computeDelta(
  r1: {
    base_salary: bigint
    bonus: bigint
    stock: bigint
    total_compensation: bigint
    experience_years: number
  },
  r2: {
    base_salary: bigint
    bonus: bigint
    stock: bigint
    total_compensation: bigint
    experience_years: number
  },
): SalaryDelta {
  return {
    base_delta: r1.base_salary - r2.base_salary,
    bonus_delta: r1.bonus - r2.bonus,
    stock_delta: r1.stock - r2.stock,
    tc_delta: r1.total_compensation - r2.total_compensation,
    experience_delta: r1.experience_years - r2.experience_years,
  }
}

// ─── Level Distribution ───────────────────────────────────────────────────────

/**
 * Returns a count of records per level for a company.
 * { L4: 12, L5: 23, SDE_II: 8, ... }
 */
export function computeLevelDistribution(
  salaries: { level: string }[],
): Record<string, number> {
  return salaries.reduce(
    (acc, s) => {
      acc[s.level] = (acc[s.level] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )
}

// ─── Salary Range ─────────────────────────────────────────────────────────────

export function computeRange(values: bigint[]): {
  min: bigint | null
  max: bigint | null
} {
  if (values.length === 0) return { min: null, max: null }
  return {
    min: values.reduce((a, b) => (a < b ? a : b)),
    max: values.reduce((a, b) => (a > b ? a : b)),
  }
}

// ─── Duplicate Detection ──────────────────────────────────────────────────────

/**
 * Returns true if newSalary is within ±tolerancePct of existingSalary.
 */
export function isWithinTolerance(
  existing: bigint,
  incoming: number,
  tolerancePct: number,
): boolean {
  const incomingBig = BigInt(Math.round(incoming))
  const tolerance = (existing * BigInt(Math.round(tolerancePct * 100))) / 100n
  const lower = existing - tolerance
  const upper = existing + tolerance
  return incomingBig >= lower && incomingBig <= upper
}
