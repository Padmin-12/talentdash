/**
 * TalentDash — Bulk Performance Seed
 * ------------------------------------
 * Generates 10,000 synthetic salary records across all 12 companies
 * to verify GET /api/salaries responds in <200ms on real query load.
 *
 * Run AFTER the main seed:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/perf-seed.ts
 *
 * WARNING: This does NOT clear existing data. Run main seed first.
 */

import 'dotenv/config'
import { PrismaClient, Level, Currency, Source } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const LEVELS: Level[] = ['L3','L4','L5','L6','SDE_I','SDE_II','SDE_III','STAFF','IC4','IC5']
const CURRENCIES: Currency[] = ['INR','INR','INR','INR','USD'] // weighted towards INR
const SOURCES: Source[] = ['CONTRIBUTOR','CONTRIBUTOR','SCRAPED','AI_INFERRED']
const LOCATIONS = ['Bengaluru','Mumbai','Hyderabad','Pune','Delhi','Chennai','Noida','Gurgaon']
const ROLES = ['Software Engineer','Data Scientist','Product Manager','Data Engineer','DevOps Engineer','ML Engineer','Backend Engineer','Frontend Engineer']

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function main() {
  console.log('⚡ Starting performance seed (10,000 records)...\n')

  const companies = await prisma.company.findMany({ select: { id: true, name: true } })
  if (companies.length === 0) {
    console.error('No companies found. Run the main seed first: npx prisma db seed')
    process.exit(1)
  }

  console.log(`Found ${companies.length} companies. Generating records...\n`)

  const BATCH_SIZE = 500
  const TOTAL = 10000
  let inserted = 0

  for (let i = 0; i < TOTAL; i += BATCH_SIZE) {
    const batch = []
    const batchEnd = Math.min(i + BATCH_SIZE, TOTAL)

    for (let j = i; j < batchEnd; j++) {
      const company = pick(companies)
      const currency = pick(CURRENCIES)
      const isUSD = currency === 'USD'
      const base = isUSD ? randInt(80000, 300000) : randInt(800000, 15000000)
      const bonus = Math.random() < 0.1 ? 0 : (isUSD ? randInt(5000, 80000) : randInt(50000, 2000000))
      const stock = Math.random() < 0.1 ? 0 : (isUSD ? randInt(0, 200000) : randInt(0, 8000000))
      const tc = base + bonus + stock

      batch.push({
        company_id: company.id,
        role: pick(ROLES),
        level: pick(LEVELS),
        location: pick(LOCATIONS),
        currency,
        experience_years: randInt(1, 20),
        base_salary: BigInt(base),
        bonus: BigInt(bonus),
        stock: BigInt(stock),
        total_compensation: BigInt(tc),
        source: pick(SOURCES),
        confidence_score: Math.round(Math.random() * 40 + 60) / 100, // 0.60–1.00
        is_verified: Math.random() > 0.7,
      })
    }

    await prisma.salary.createMany({ data: batch })
    inserted += batch.length
    process.stdout.write(`\r  Inserted ${inserted}/${TOTAL} records...`)
  }

  const total = await prisma.salary.count()
  console.log(`\n\n✓ Done. Total records in DB: ${total}`)
  console.log('\nNow run the performance test:')
  console.log('  npx ts-node --compiler-options \'{"module":"CommonJS"}\' prisma/perf-test.ts\n')
}

main()
  .catch((e) => { console.error('\nFailed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
