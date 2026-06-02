/**
 * perf-seed.js — run with: node prisma/perf-seed.js
 * Inserts 10,000 synthetic salary records via Prisma REST/direct SQL
 * to validate <200ms query guarantee on B3.
 */

require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const LEVELS  = ['L3','L4','L5','L6','SDE_I','SDE_II','SDE_III','STAFF','IC4','IC5']
const SOURCES = ['CONTRIBUTOR','CONTRIBUTOR','SCRAPED','AI_INFERRED']
const LOCS    = ['Bengaluru','Mumbai','Hyderabad','Pune','Delhi','Chennai','Noida','Gurgaon']
const ROLES   = ['Software Engineer','Data Scientist','Product Manager','Data Engineer','DevOps Engineer','ML Engineer']

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true } })
  if (!companies.length) { console.error('Run main seed first: npx prisma db seed'); process.exit(1) }

  console.log(`\n⚡ Inserting 10,000 perf records across ${companies.length} companies...\n`)

  const BATCH = 500
  const TOTAL = 10000
  let inserted = 0

  for (let i = 0; i < TOTAL; i += BATCH) {
    const rows = []
    for (let j = 0; j < BATCH && i + j < TOTAL; j++) {
      const isUSD = Math.random() < 0.15
      const base  = isUSD ? rand(80000, 300000)    : rand(600000, 15000000)
      const bonus = Math.random() < 0.1 ? 0 : (isUSD ? rand(5000,80000)   : rand(40000,2000000))
      const stock = Math.random() < 0.1 ? 0 : (isUSD ? rand(0,200000)     : rand(0,8000000))
      rows.push({
        company_id:          pick(companies).id,
        role:                pick(ROLES),
        level:               pick(LEVELS),
        location:            pick(LOCS),
        currency:            isUSD ? 'USD' : 'INR',
        experience_years:    rand(1, 20),
        base_salary:         BigInt(base),
        bonus:               BigInt(bonus),
        stock:               BigInt(stock),
        total_compensation:  BigInt(base + bonus + stock),
        source:              pick(SOURCES),
        confidence_score:    (rand(60, 100) / 100),
        is_verified:         Math.random() > 0.7,
      })
    }
    await prisma.salary.createMany({ data: rows })
    inserted += rows.length
    process.stdout.write(`\r  ${inserted}/${TOTAL}...`)
  }

  const total = await prisma.salary.count()
  console.log(`\n\n✅ Done. Total records in DB: ${total}\n`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
