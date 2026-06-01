import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  computeMedian,
  computeLevelDistribution,
  computeRange,
} from '@/lib/compute'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  // ── Fetch company ──────────────────────────────────────────────────────────
  const company = await prisma.company.findUnique({
    where: { slug },
    include: {
      salaries: {
        orderBy: { total_compensation: 'desc' },
      },
    },
  })

  if (!company) {
    return NextResponse.json(
      { error: true, message: 'Company not found' },
      { status: 404 },
    )
  }

  const { salaries, ...companyMeta } = company

  // ── Compute aggregates ─────────────────────────────────────────────────────
  const tcValues = salaries.map((s) => s.total_compensation)

  const median_total_compensation = computeMedian(tcValues)
  const { min: tc_min, max: tc_max } = computeRange(tcValues)
  const level_distribution = computeLevelDistribution(salaries)

  // ── Serialise ──────────────────────────────────────────────────────────────
  const serialisedSalaries = salaries.map(serialiseSalary)

  return NextResponse.json(
    {
      company: companyMeta,
      record_count: salaries.length,
      median_total_compensation: median_total_compensation?.toString() ?? null,
      tc_range: {
        min: tc_min?.toString() ?? null,
        max: tc_max?.toString() ?? null,
      },
      level_distribution,
      salaries: serialisedSalaries,
    },
    {
      headers: {
        // Cloudflare CDN caches for 1h, serves stale for 24h while revalidating
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
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
