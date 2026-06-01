import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { IngestSalarySchema, formatZodError } from '@/lib/validate'
import { normaliseCompanyName, toSlug } from '@/lib/normalise'
import { computeTotalCompensation, isWithinTolerance } from '@/lib/compute'
import { DUPLICATE_WINDOW_HOURS, DUPLICATE_SALARY_TOLERANCE } from '@/lib/constants'

export async function POST(request: NextRequest) {
  // ── 1. Parse body ──────────────────────────────────────────────────────────
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: true, field: 'body', message: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  // ── 2. Zod validation ──────────────────────────────────────────────────────
  const parsed = IngestSalarySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(formatZodError(parsed.error), { status: 400 })
  }

  const data = parsed.data

  // ── 3. Normalise company name ──────────────────────────────────────────────
  const normalised = normaliseCompanyName(data.company)
  const slug = toSlug(normalised)

  // ── 4. Find or create Company ──────────────────────────────────────────────
  let company = await prisma.company.findUnique({
    where: { normalized_name: normalised },
  })

  if (!company) {
    // Check slug collision (rare but safe)
    const slugExists = await prisma.company.findUnique({ where: { slug } })
    const finalSlug = slugExists ? `${slug}-${Date.now()}` : slug

    company = await prisma.company.create({
      data: {
        name: data.company.trim(), // Preserve original display name
        slug: finalSlug,
        normalized_name: normalised,
      },
    })
  }

  // ── 5. Strip client total_compensation, recompute server-side ──────────────
  const total_compensation = computeTotalCompensation(
    data.base_salary,
    data.bonus,
    data.stock,
  )

  // ── 6. Duplicate check ─────────────────────────────────────────────────────
  // Same company + role + level + location submitted within 48h with base ±10%
  const windowStart = new Date(
    Date.now() - DUPLICATE_WINDOW_HOURS * 60 * 60 * 1000,
  )

  const recentRecords = await prisma.salary.findMany({
    where: {
      company_id: company.id,
      role: { equals: data.role, mode: 'insensitive' },
      level: data.level,
      location: { equals: data.location, mode: 'insensitive' },
      submitted_at: { gte: windowStart },
    },
    select: { base_salary: true },
  })

  const isDuplicate = recentRecords.some((r) =>
    isWithinTolerance(r.base_salary, data.base_salary, DUPLICATE_SALARY_TOLERANCE),
  )

  if (isDuplicate) {
    return NextResponse.json(
      {
        error: true,
        field: 'base_salary',
        message: `A similar record for ${data.role} at this company, level, and location was already submitted within the last ${DUPLICATE_WINDOW_HOURS} hours. Duplicate rejected.`,
      },
      { status: 409 },
    )
  }

  // ── 7. Insert record ────────────────────────────────────────────────────────
  const salary = await prisma.salary.create({
    data: {
      company_id: company.id,
      role: data.role,
      level: data.level,
      location: data.location,
      currency: data.currency,
      experience_years: data.experience_years,
      base_salary: BigInt(Math.round(data.base_salary)),
      bonus: BigInt(Math.round(data.bonus)),
      stock: BigInt(Math.round(data.stock)),
      total_compensation,
      source: data.source,
      confidence_score: data.confidence_score,
      is_verified: false,
      submitted_at: new Date(),
    },
    include: { company: true },
  })

  // ── 8. Return stored record (BigInt → string for JSON serialisation) ────────
  return NextResponse.json(serialiseSalary(salary), { status: 201 })
}

// BigInt cannot be JSON-serialised natively — convert to string for transport
function serialiseSalary(salary: any) {
  return {
    ...salary,
    base_salary: salary.base_salary.toString(),
    bonus: salary.bonus.toString(),
    stock: salary.stock.toString(),
    total_compensation: salary.total_compensation.toString(),
    confidence_score: salary.confidence_score.toString(),
  }
}
