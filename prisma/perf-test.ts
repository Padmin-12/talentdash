/**
 * TalentDash — Query Performance Test
 * -------------------------------------
 * Times GET /api/salaries with realistic filters on a 10k row dataset.
 * Target: <200ms application-code time per the spec (B3).
 *
 * Run AFTER perf-seed.ts:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/perf-test.ts
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

interface TestCase {
  name: string
  url: string
}

const TESTS: TestCase[] = [
  { name: 'No filters (cold)',         url: `${BASE}/api/salaries` },
  { name: 'Company filter (ILIKE)',     url: `${BASE}/api/salaries?company=google` },
  { name: 'Level filter (exact)',       url: `${BASE}/api/salaries?level=SDE_II` },
  { name: 'Location filter (ILIKE)',    url: `${BASE}/api/salaries?location=Bengaluru` },
  { name: 'All filters combined',       url: `${BASE}/api/salaries?company=amazon&level=SDE_II&location=Bengaluru&sort=total_comp_desc` },
  { name: 'Sort by TC desc',            url: `${BASE}/api/salaries?sort=total_comp_desc&limit=100` },
  { name: 'USD currency filter',        url: `${BASE}/api/salaries?currency=USD` },
  { name: 'No filters (warm)',          url: `${BASE}/api/salaries` },
]

async function runTest(test: TestCase): Promise<number> {
  const start = performance.now()
  const res = await fetch(test.url)
  const elapsed = performance.now() - start
  const data = await res.json()
  const total = data?.meta?.total ?? '?'
  return elapsed
}

async function main() {
  const total = await prisma.salary.count()
  console.log(`\n⚡ TalentDash Query Performance Test`)
  console.log(`   Database: ${total.toLocaleString()} records`)
  console.log(`   Target:   <200ms per query\n`)
  console.log('─'.repeat(60))

  let allPassed = true

  for (const test of TESTS) {
    // Warm up
    await fetch(test.url).catch(() => {})
    
    // Average over 3 runs
    const times: number[] = []
    for (let i = 0; i < 3; i++) {
      times.push(await runTest(test))
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length
    const pass = avg < 200
    if (!pass) allPassed = false

    console.log(`${pass ? '✅' : '❌'} ${test.name.padEnd(30)} ${avg.toFixed(0).padStart(5)}ms ${pass ? '' : '← SLOW'}`)
  }

  console.log('─'.repeat(60))
  console.log(allPassed ? '\n✅ All queries under 200ms\n' : '\n❌ Some queries exceeded 200ms — add indexes\n')
}

main()
  .catch((e) => { console.error('Test failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
