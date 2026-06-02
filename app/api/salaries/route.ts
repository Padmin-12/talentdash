import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SalaryQuerySchema, formatZodError } from '@/lib/validate'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/lib/constants'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  // ── Parse + validate query params ─────────────────────────────────────────
  const rawParams = {
    company: searchParams.get('company') ?? undefined,
    role: searchParams.get('role') ?? undefined,
    level: searchParams.get('level') ?? undefined,
    location: searchParams.get('location') ?? undefined,
    currency: searchParams.get('currency') ?? undefined,
    sort: searchParams.get('sort') ?? undefined,
    page: searchParams.get('page') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  }

  const parsed = SalaryQuerySchema.safeParse(rawParams)
  if (!parsed.success) {
    return NextResponse.json(formatZodError(parsed.error), { status: 400 })
  }

  const {
    company,
    role,
    level,
    location,
    currency,
    sort,
    page,
    limit: rawLimit,
  } = parsed.data

  // Hard cap — even if Zod passes 100, enforce it here too
  const limit = Math.min(rawLimit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
  const skip = ((page ?? 1) - 1) * limit

  // ── Build where clause ─────────────────────────────────────────────────────
  const where: Prisma.SalaryWhereInput = {}

  if (company) {
    where.company = {
      name: { contains: company, mode: 'insensitive' },
    }
  }

  if (role) {
    where.role = { contains: role, mode: 'insensitive' }
  }

  if (level) {
    where.level = level
  }

  if (location) {
    where.location = { contains: location, mode: 'insensitive' }
  }

  if (currency) {
    where.currency = currency
  }

  // ── Build order by ─────────────────────────────────────────────────────────
  let orderBy: Prisma.SalaryOrderByWithRelationInput

  switch (sort) {
    case 'total_comp_asc':
      orderBy = { total_compensation: 'asc' }
      break
    case 'date_desc':
      orderBy = { submitted_at: 'desc' }
      break
    case 'total_comp_desc':
    default:
      orderBy = { total_compensation: 'desc' }
  }

  // ── Execute queries (count + data in parallel) ─────────────────────────────
  const dbStart = Date.now()
  const [total, salaries] = await Promise.all([
    prisma.salary.count({ where }),
    prisma.salary.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        company: {
          select: { name: true, slug: true, industry: true, headquarters: true },
        },
      },
    }),
  ])
  const dbMs = Date.now() - dbStart

  const totalPages = Math.ceil(total / limit)

  // ── Serialise BigInt fields ────────────────────────────────────────────────
  const data = salaries.map(serialiseSalary)

  return NextResponse.json(
    {
      data,
      meta: {
        total,
        page: page ?? 1,
        limit,
        totalPages,
      },
    },
    {
      headers: {
        // Cloudflare CDN caches for 5 min, serves stale for 1h while revalidating
        'Cache-Control': 's-maxage=300, stale-while-revalidate=3600',
        // Server-side DB query time — proves <200ms spec on 10k rows
        'X-DB-Time': `${dbMs}ms`,
      },
    },
  )
}

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
