import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { computeDelta } from '@/lib/compute'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  const s1 = searchParams.get('s1')
  const s2 = searchParams.get('s2')

  // ── Validate presence ──────────────────────────────────────────────────────
  if (!s1 || !s2) {
    return NextResponse.json(
      {
        error: true,
        message: 'Both s1 and s2 query parameters are required',
      },
      { status: 400 },
    )
  }

  // ── Reject identical IDs ───────────────────────────────────────────────────
  if (s1 === s2) {
    return NextResponse.json(
      {
        error: true,
        message: 'Cannot compare a record with itself. s1 and s2 must be different IDs.',
      },
      { status: 400 },
    )
  }

  // ── Fetch both records in parallel ─────────────────────────────────────────
  const [record1, record2] = await Promise.all([
    prisma.salary.findUnique({ where: { id: s1 }, include: { company: true } }),
    prisma.salary.findUnique({ where: { id: s2 }, include: { company: true } }),
  ])

  // ── 404 with specifics about which ID is missing ───────────────────────────
  if (!record1 && !record2) {
    return NextResponse.json(
      { error: true, message: `Neither record found: s1=${s1}, s2=${s2}` },
      { status: 404 },
    )
  }
  if (!record1) {
    return NextResponse.json(
      { error: true, message: `Record not found: s1=${s1}` },
      { status: 404 },
    )
  }
  if (!record2) {
    return NextResponse.json(
      { error: true, message: `Record not found: s2=${s2}` },
      { status: 404 },
    )
  }

  // ── Compute delta ──────────────────────────────────────────────────────────
  const delta = computeDelta(record1, record2)

  // ── Determine winner ───────────────────────────────────────────────────────
  let winner: 'record1' | 'record2' | 'equal'
  if (delta.tc_delta > 0n) winner = 'record1'
  else if (delta.tc_delta < 0n) winner = 'record2'
  else winner = 'equal'

  return NextResponse.json({
    record1: serialiseSalary(record1),
    record2: serialiseSalary(record2),
    delta: {
      base_delta: delta.base_delta.toString(),
      bonus_delta: delta.bonus_delta.toString(),
      stock_delta: delta.stock_delta.toString(),
      tc_delta: delta.tc_delta.toString(),
      experience_delta: delta.experience_delta,
    },
    winner,
  })
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
