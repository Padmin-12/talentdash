import 'dotenv/config'
import { PrismaClient, Level, Currency, Source } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { normaliseCompanyName, toSlug } from '../lib/normalise'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })


// ─── Company display names + intentional variant names for normalisation demo ──

const COMPANIES: Array<{
  displayName: string       // How we store the display name
  variantNames: string[]    // Variants that should all resolve to the same Company
  industry: string
  headquarters: string
  founded_year?: number
  headcount_range?: string
}> = [
  {
    displayName: 'Google',
    variantNames: ['Google India', 'GOOGLE', 'google'],  // All resolve to "google"
    industry: 'Technology',
    headquarters: 'Mountain View, CA',
    founded_year: 1998,
    headcount_range: '100000+',
  },
  {
    displayName: 'Amazon',
    variantNames: ['amazon.com', 'Amazon'],
    industry: 'Technology / E-Commerce',
    headquarters: 'Seattle, WA',
    founded_year: 1994,
    headcount_range: '100000+',
  },
  {
    displayName: 'Meta',
    variantNames: ['Meta Platforms', 'Facebook'],
    industry: 'Technology / Social Media',
    headquarters: 'Menlo Park, CA',
    founded_year: 2004,
    headcount_range: '50000-100000',
  },
  {
    displayName: 'Microsoft',
    variantNames: ['Microsoft India', 'Microsoft'],
    industry: 'Technology',
    headquarters: 'Redmond, WA',
    founded_year: 1975,
    headcount_range: '100000+',
  },
  {
    displayName: 'Flipkart',
    variantNames: ['Flipkart Internet Pvt Ltd', 'Flipkart'],
    industry: 'E-Commerce',
    headquarters: 'Bengaluru, India',
    founded_year: 2007,
    headcount_range: '20000-50000',
  },
  {
    displayName: 'Meesho',
    variantNames: ['Meesho'],
    industry: 'Social Commerce',
    headquarters: 'Bengaluru, India',
    founded_year: 2015,
    headcount_range: '5000-10000',
  },
  {
    displayName: 'NVIDIA',
    variantNames: ['NVIDIA'],
    industry: 'Semiconductors',
    headquarters: 'Santa Clara, CA',
    founded_year: 1993,
    headcount_range: '20000-50000',
  },
  {
    displayName: 'TCS',
    variantNames: ['Tata Consultancy Services', 'TCS Ltd.', 'TCS'],
    industry: 'IT Services',
    headquarters: 'Mumbai, India',
    founded_year: 1968,
    headcount_range: '500000+',
  },
  {
    displayName: 'Infosys',
    variantNames: ['Infosys BPO', 'INFOSYS', 'Infosys'],
    industry: 'IT Services',
    headquarters: 'Bengaluru, India',
    founded_year: 1981,
    headcount_range: '300000+',
  },
  {
    displayName: 'Wipro',
    variantNames: ['Wipro Technologies', 'Wipro'],
    industry: 'IT Services',
    headquarters: 'Bengaluru, India',
    founded_year: 1945,
    headcount_range: '200000+',
  },
  {
    displayName: 'Razorpay',
    variantNames: ['Razorpay'],
    industry: 'Fintech',
    headquarters: 'Bengaluru, India',
    founded_year: 2014,
    headcount_range: '2000-5000',
  },
  {
    displayName: 'Zepto',
    variantNames: ['Zepto'],
    industry: 'Quick Commerce',
    headquarters: 'Mumbai, India',
    founded_year: 2021,
    headcount_range: '2000-5000',
  },
]

// ─── Salary Records ───────────────────────────────────────────────────────────

interface SeedSalary {
  companyVariant: string  // The variant name used — normaliser maps it to slug
  role: string
  level: Level
  location: string
  currency: Currency
  experience_years: number
  base_salary: number
  bonus: number
  stock: number
  source: Source
  confidence_score: number
}

const SEED_SALARIES: SeedSalary[] = [
  // ── Google ────────────────────────────────────────────────────────────────
  { companyVariant: 'Google India', role: 'Software Engineer', level: 'L3', location: 'Bengaluru', currency: 'INR', experience_years: 1, base_salary: 2200000, bonus: 200000, stock: 400000, source: 'CONTRIBUTOR', confidence_score: 0.95 },
  { companyVariant: 'GOOGLE', role: 'Software Engineer', level: 'L4', location: 'Bengaluru', currency: 'INR', experience_years: 3, base_salary: 3500000, bonus: 400000, stock: 1200000, source: 'CONTRIBUTOR', confidence_score: 0.92 },
  { companyVariant: 'google', role: 'Software Engineer', level: 'L5', location: 'Bengaluru', currency: 'INR', experience_years: 6, base_salary: 5500000, bonus: 700000, stock: 2500000, source: 'CONTRIBUTOR', confidence_score: 0.9 },
  { companyVariant: 'Google', role: 'Software Engineer', level: 'L6', location: 'Bengaluru', currency: 'INR', experience_years: 10, base_salary: 8000000, bonus: 1200000, stock: 5000000, source: 'CONTRIBUTOR', confidence_score: 0.88 },
  { companyVariant: 'Google', role: 'Software Engineer', level: 'L5', location: 'San Francisco', currency: 'USD', experience_years: 7, base_salary: 230000, bonus: 50000, stock: 120000, source: 'CONTRIBUTOR', confidence_score: 0.93 },
  { companyVariant: 'Google', role: 'Product Manager', level: 'L5', location: 'Bengaluru', currency: 'INR', experience_years: 7, base_salary: 6000000, bonus: 900000, stock: 3000000, source: 'CONTRIBUTOR', confidence_score: 0.85 },
  { companyVariant: 'Google', role: 'Data Scientist', level: 'L4', location: 'Hyderabad', currency: 'INR', experience_years: 4, base_salary: 3200000, bonus: 350000, stock: 1000000, source: 'SCRAPED', confidence_score: 0.65 },
  { companyVariant: 'Google', role: 'Staff Engineer', level: 'STAFF', location: 'Bengaluru', currency: 'INR', experience_years: 12, base_salary: 12000000, bonus: 2000000, stock: 8000000, source: 'CONTRIBUTOR', confidence_score: 0.9 },

  // ── Amazon ────────────────────────────────────────────────────────────────
  { companyVariant: 'amazon.com', role: 'Software Development Engineer', level: 'SDE_I', location: 'Bengaluru', currency: 'INR', experience_years: 1, base_salary: 2000000, bonus: 250000, stock: 600000, source: 'CONTRIBUTOR', confidence_score: 0.91 },
  { companyVariant: 'Amazon', role: 'Software Development Engineer', level: 'SDE_II', location: 'Bengaluru', currency: 'INR', experience_years: 4, base_salary: 3800000, bonus: 450000, stock: 1800000, source: 'CONTRIBUTOR', confidence_score: 0.93 },
  { companyVariant: 'Amazon', role: 'Software Development Engineer', level: 'SDE_III', location: 'Bengaluru', currency: 'INR', experience_years: 8, base_salary: 6200000, bonus: 800000, stock: 3500000, source: 'CONTRIBUTOR', confidence_score: 0.88 },
  { companyVariant: 'Amazon', role: 'Software Development Engineer', level: 'SDE_II', location: 'Hyderabad', currency: 'INR', experience_years: 5, base_salary: 3600000, bonus: 400000, stock: 1500000, source: 'SCRAPED', confidence_score: 0.62 },
  { companyVariant: 'Amazon', role: 'Product Manager', level: 'L5', location: 'Bengaluru', currency: 'INR', experience_years: 6, base_salary: 4800000, bonus: 600000, stock: 2000000, source: 'CONTRIBUTOR', confidence_score: 0.87 },
  { companyVariant: 'Amazon', role: 'Data Engineer', level: 'SDE_II', location: 'Chennai', currency: 'INR', experience_years: 4, base_salary: 3200000, bonus: 300000, stock: 1000000, source: 'AI_INFERRED', confidence_score: 0.62 },
  // Edge case: zero bonus
  { companyVariant: 'Amazon', role: 'Software Development Engineer', level: 'SDE_I', location: 'Pune', currency: 'INR', experience_years: 2, base_salary: 1800000, bonus: 0, stock: 400000, source: 'CONTRIBUTOR', confidence_score: 0.83 },

  // ── Meta ──────────────────────────────────────────────────────────────────
  { companyVariant: 'Meta Platforms', role: 'Software Engineer', level: 'L4', location: 'Bengaluru', currency: 'INR', experience_years: 3, base_salary: 4200000, bonus: 600000, stock: 2200000, source: 'CONTRIBUTOR', confidence_score: 0.9 },
  { companyVariant: 'Facebook', role: 'Software Engineer', level: 'L5', location: 'Bengaluru', currency: 'INR', experience_years: 7, base_salary: 6800000, bonus: 1000000, stock: 4000000, source: 'CONTRIBUTOR', confidence_score: 0.92 },
  { companyVariant: 'Meta Platforms', role: 'Software Engineer', level: 'L6', location: 'San Francisco', currency: 'USD', experience_years: 11, base_salary: 280000, bonus: 80000, stock: 200000, source: 'CONTRIBUTOR', confidence_score: 0.94 },
  // Edge case: zero stock
  { companyVariant: 'Meta Platforms', role: 'Data Analyst', level: 'L3', location: 'Mumbai', currency: 'INR', experience_years: 2, base_salary: 1900000, bonus: 150000, stock: 0, source: 'CONTRIBUTOR', confidence_score: 0.78 },

  // ── Microsoft ─────────────────────────────────────────────────────────────
  { companyVariant: 'Microsoft India', role: 'Software Engineer', level: 'SDE_I', location: 'Hyderabad', currency: 'INR', experience_years: 2, base_salary: 2400000, bonus: 300000, stock: 800000, source: 'CONTRIBUTOR', confidence_score: 0.9 },
  { companyVariant: 'Microsoft', role: 'Software Engineer', level: 'SDE_II', location: 'Hyderabad', currency: 'INR', experience_years: 5, base_salary: 4200000, bonus: 550000, stock: 2000000, source: 'CONTRIBUTOR', confidence_score: 0.88 },
  { companyVariant: 'Microsoft', role: 'Software Engineer', level: 'L6', location: 'Hyderabad', currency: 'INR', experience_years: 10, base_salary: 7500000, bonus: 1100000, stock: 4500000, source: 'CONTRIBUTOR', confidence_score: 0.9 },
  { companyVariant: 'Microsoft', role: 'Software Engineer', level: 'L5', location: 'London', currency: 'GBP', experience_years: 8, base_salary: 140000, bonus: 25000, stock: 60000, source: 'CONTRIBUTOR', confidence_score: 0.85 },
  { companyVariant: 'Microsoft', role: 'Principal Engineer', level: 'PRINCIPAL', location: 'Hyderabad', currency: 'INR', experience_years: 16, base_salary: 18000000, bonus: 3000000, stock: 12000000, source: 'CONTRIBUTOR', confidence_score: 0.88 },

  // ── Flipkart ──────────────────────────────────────────────────────────────
  { companyVariant: 'Flipkart Internet Pvt Ltd', role: 'Software Engineer', level: 'SDE_I', location: 'Bengaluru', currency: 'INR', experience_years: 1, base_salary: 1800000, bonus: 180000, stock: 500000, source: 'CONTRIBUTOR', confidence_score: 0.87 },
  { companyVariant: 'Flipkart', role: 'Software Engineer', level: 'SDE_II', location: 'Bengaluru', currency: 'INR', experience_years: 4, base_salary: 3400000, bonus: 400000, stock: 1500000, source: 'CONTRIBUTOR', confidence_score: 0.89 },
  { companyVariant: 'Flipkart', role: 'Software Engineer', level: 'SDE_III', location: 'Bengaluru', currency: 'INR', experience_years: 8, base_salary: 5500000, bonus: 700000, stock: 3000000, source: 'CONTRIBUTOR', confidence_score: 0.85 },
  { companyVariant: 'Flipkart', role: 'Product Manager', level: 'L4', location: 'Bengaluru', currency: 'INR', experience_years: 5, base_salary: 3200000, bonus: 350000, stock: 1200000, source: 'SCRAPED', confidence_score: 0.6 },
  { companyVariant: 'Flipkart', role: 'Data Scientist', level: 'SDE_II', location: 'Bengaluru', currency: 'INR', experience_years: 4, base_salary: 3000000, bonus: 280000, stock: 900000, source: 'CONTRIBUTOR', confidence_score: 0.82 },

  // ── Meesho ────────────────────────────────────────────────────────────────
  { companyVariant: 'Meesho', role: 'Software Engineer', level: 'SDE_I', location: 'Bengaluru', currency: 'INR', experience_years: 2, base_salary: 1600000, bonus: 120000, stock: 400000, source: 'CONTRIBUTOR', confidence_score: 0.84 },
  { companyVariant: 'Meesho', role: 'Software Engineer', level: 'SDE_II', location: 'Bengaluru', currency: 'INR', experience_years: 5, base_salary: 2800000, bonus: 250000, stock: 900000, source: 'CONTRIBUTOR', confidence_score: 0.82 },
  { companyVariant: 'Meesho', role: 'Software Engineer', level: 'SDE_III', location: 'Bengaluru', currency: 'INR', experience_years: 8, base_salary: 4500000, bonus: 500000, stock: 2000000, source: 'CONTRIBUTOR', confidence_score: 0.8 },
  { companyVariant: 'Meesho', role: 'Data Analyst', level: 'L3', location: 'Bengaluru', currency: 'INR', experience_years: 2, base_salary: 1400000, bonus: 100000, stock: 250000, source: 'SCRAPED', confidence_score: 0.58 },

  // ── NVIDIA ────────────────────────────────────────────────────────────────
  { companyVariant: 'NVIDIA', role: 'Software Engineer', level: 'IC4', location: 'Bengaluru', currency: 'INR', experience_years: 5, base_salary: 6500000, bonus: 1000000, stock: 4000000, source: 'CONTRIBUTOR', confidence_score: 0.91 },
  { companyVariant: 'NVIDIA', role: 'Software Engineer', level: 'IC5', location: 'Bengaluru', currency: 'INR', experience_years: 9, base_salary: 10000000, bonus: 2000000, stock: 8000000, source: 'CONTRIBUTOR', confidence_score: 0.9 },
  // Edge case: very high equity
  { companyVariant: 'NVIDIA', role: 'Staff Machine Learning Engineer', level: 'STAFF', location: 'San Francisco', currency: 'USD', experience_years: 12, base_salary: 280000, bonus: 100000, stock: 400000, source: 'CONTRIBUTOR', confidence_score: 0.93 },
  { companyVariant: 'NVIDIA', role: 'Data Scientist', level: 'IC4', location: 'Hyderabad', currency: 'INR', experience_years: 6, base_salary: 5800000, bonus: 800000, stock: 3200000, source: 'CONTRIBUTOR', confidence_score: 0.86 },

  // ── TCS ───────────────────────────────────────────────────────────────────
  { companyVariant: 'Tata Consultancy Services', role: 'Software Engineer', level: 'L3', location: 'Mumbai', currency: 'INR', experience_years: 1, base_salary: 700000, bonus: 50000, stock: 0, source: 'CONTRIBUTOR', confidence_score: 0.85 },
  { companyVariant: 'TCS Ltd.', role: 'Software Engineer', level: 'L4', location: 'Hyderabad', currency: 'INR', experience_years: 4, base_salary: 1100000, bonus: 80000, stock: 0, source: 'CONTRIBUTOR', confidence_score: 0.82 },
  { companyVariant: 'TCS', role: 'Software Engineer', level: 'L5', location: 'Pune', currency: 'INR', experience_years: 7, base_salary: 1600000, bonus: 100000, stock: 0, source: 'SCRAPED', confidence_score: 0.6 },
  { companyVariant: 'TCS', role: 'Data Analyst', level: 'L3', location: 'Delhi', currency: 'INR', experience_years: 2, base_salary: 650000, bonus: 40000, stock: 0, source: 'CONTRIBUTOR', confidence_score: 0.8 },
  { companyVariant: 'TCS', role: 'Product Manager', level: 'L4', location: 'Mumbai', currency: 'INR', experience_years: 5, base_salary: 1800000, bonus: 150000, stock: 0, source: 'CONTRIBUTOR', confidence_score: 0.78 },

  // ── Infosys ───────────────────────────────────────────────────────────────
  { companyVariant: 'Infosys BPO', role: 'Software Engineer', level: 'L3', location: 'Bengaluru', currency: 'INR', experience_years: 1, base_salary: 750000, bonus: 60000, stock: 0, source: 'CONTRIBUTOR', confidence_score: 0.84 },
  { companyVariant: 'INFOSYS', role: 'Software Engineer', level: 'L4', location: 'Pune', currency: 'INR', experience_years: 4, base_salary: 1200000, bonus: 90000, stock: 0, source: 'CONTRIBUTOR', confidence_score: 0.82 },
  { companyVariant: 'Infosys', role: 'Software Engineer', level: 'L5', location: 'Hyderabad', currency: 'INR', experience_years: 7, base_salary: 1800000, bonus: 150000, stock: 100000, source: 'SCRAPED', confidence_score: 0.61 },
  { companyVariant: 'Infosys', role: 'Data Scientist', level: 'L4', location: 'Bengaluru', currency: 'INR', experience_years: 4, base_salary: 1500000, bonus: 100000, stock: 0, source: 'CONTRIBUTOR', confidence_score: 0.79 },

  // ── Wipro ─────────────────────────────────────────────────────────────────
  { companyVariant: 'Wipro Technologies', role: 'Software Engineer', level: 'L3', location: 'Bengaluru', currency: 'INR', experience_years: 1, base_salary: 700000, bonus: 50000, stock: 0, source: 'CONTRIBUTOR', confidence_score: 0.83 },
  { companyVariant: 'Wipro', role: 'Software Engineer', level: 'L4', location: 'Chennai', currency: 'INR', experience_years: 4, base_salary: 1100000, bonus: 70000, stock: 0, source: 'CONTRIBUTOR', confidence_score: 0.8 },
  { companyVariant: 'Wipro', role: 'Software Engineer', level: 'L5', location: 'Hyderabad', currency: 'INR', experience_years: 8, base_salary: 1700000, bonus: 120000, stock: 0, source: 'SCRAPED', confidence_score: 0.59 },

  // ── Razorpay ──────────────────────────────────────────────────────────────
  { companyVariant: 'Razorpay', role: 'Software Engineer', level: 'SDE_I', location: 'Bengaluru', currency: 'INR', experience_years: 1, base_salary: 2000000, bonus: 180000, stock: 600000, source: 'CONTRIBUTOR', confidence_score: 0.89 },
  { companyVariant: 'Razorpay', role: 'Software Engineer', level: 'SDE_II', location: 'Bengaluru', currency: 'INR', experience_years: 4, base_salary: 3500000, bonus: 400000, stock: 1500000, source: 'CONTRIBUTOR', confidence_score: 0.88 },
  { companyVariant: 'Razorpay', role: 'Software Engineer', level: 'SDE_III', location: 'Bengaluru', currency: 'INR', experience_years: 8, base_salary: 5200000, bonus: 700000, stock: 3000000, source: 'CONTRIBUTOR', confidence_score: 0.85 },
  { companyVariant: 'Razorpay', role: 'Product Manager', level: 'L5', location: 'Bengaluru', currency: 'INR', experience_years: 6, base_salary: 4000000, bonus: 500000, stock: 2000000, source: 'CONTRIBUTOR', confidence_score: 0.82 },
  // Edge case: zero bonus, zero stock (TC = base exactly)
  { companyVariant: 'Razorpay', role: 'DevOps Engineer', level: 'SDE_I', location: 'Bengaluru', currency: 'INR', experience_years: 2, base_salary: 1600000, bonus: 0, stock: 0, source: 'CONTRIBUTOR', confidence_score: 0.76 },

  // ── Zepto ─────────────────────────────────────────────────────────────────
  { companyVariant: 'Zepto', role: 'Software Engineer', level: 'SDE_I', location: 'Mumbai', currency: 'INR', experience_years: 1, base_salary: 1800000, bonus: 150000, stock: 500000, source: 'CONTRIBUTOR', confidence_score: 0.85 },
  { companyVariant: 'Zepto', role: 'Software Engineer', level: 'SDE_II', location: 'Mumbai', currency: 'INR', experience_years: 3, base_salary: 3000000, bonus: 280000, stock: 1000000, source: 'CONTRIBUTOR', confidence_score: 0.83 },
  { companyVariant: 'Zepto', role: 'Data Engineer', level: 'SDE_II', location: 'Mumbai', currency: 'INR', experience_years: 3, base_salary: 2800000, bonus: 220000, stock: 800000, source: 'SCRAPED', confidence_score: 0.6 },
  { companyVariant: 'Zepto', role: 'Staff Engineer', level: 'STAFF', location: 'Mumbai', currency: 'INR', experience_years: 11, base_salary: 7000000, bonus: 1200000, stock: 5000000, source: 'CONTRIBUTOR', confidence_score: 0.87 },
]

// ─── Seed Function ────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting TalentDash seed...\n')

  // ── Clear existing data ────────────────────────────────────────────────────
  await prisma.salary.deleteMany()
  await prisma.company.deleteMany()
  console.log('✓ Cleared existing data\n')

  // ── Create companies (deduplicated by normalized_name) ────────────────────
  const companyMap = new Map<string, string>() // normalised_name → company.id

  for (const co of COMPANIES) {
    // Use first variant as the canonical display name's normalised form
    const normalised = normaliseCompanyName(co.displayName)
    const slug = toSlug(normalised)

    const company = await prisma.company.create({
      data: {
        name: co.displayName,
        slug,
        normalized_name: normalised,
        industry: co.industry,
        headquarters: co.headquarters,
        founded_year: co.founded_year,
        headcount_range: co.headcount_range,
      },
    })

    // Register all variant names as pointing to this company
    for (const variant of co.variantNames) {
      const normVariant = normaliseCompanyName(variant)
      companyMap.set(normVariant, company.id)
    }
    // Also register the canonical normalised name
    companyMap.set(normalised, company.id)

    console.log(`  ✓ Created company: ${co.displayName} (slug: ${slug})`)
  }

  console.log(`\n✓ Created ${COMPANIES.length} companies\n`)

  // ── Insert salary records ──────────────────────────────────────────────────
  let inserted = 0
  let failed = 0

  for (const record of SEED_SALARIES) {
    const normVariant = normaliseCompanyName(record.companyVariant)
    const companyId = companyMap.get(normVariant)

    if (!companyId) {
      console.error(
        `  ✗ Could not resolve company "${record.companyVariant}" (normalised: "${normVariant}")`,
      )
      failed++
      continue
    }

    // CRITICAL: Always recompute TC server-side
    const total_compensation =
      BigInt(Math.round(record.base_salary)) +
      BigInt(Math.round(record.bonus)) +
      BigInt(Math.round(record.stock))

    await prisma.salary.create({
      data: {
        company_id: companyId,
        role: record.role,
        level: record.level,
        location: record.location,
        currency: record.currency,
        experience_years: record.experience_years,
        base_salary: BigInt(Math.round(record.base_salary)),
        bonus: BigInt(Math.round(record.bonus)),
        stock: BigInt(Math.round(record.stock)),
        total_compensation,
        source: record.source,
        confidence_score: record.confidence_score,
        is_verified: record.source === 'CONTRIBUTOR' && record.confidence_score >= 0.85,
      },
    })

    inserted++
  }

  console.log(`✓ Inserted ${inserted} salary records`)
  if (failed > 0) console.log(`✗ Failed to insert ${failed} records`)

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n── Seed Summary ──────────────────────────────────────────')
  console.log(`  Companies: ${COMPANIES.length}`)
  console.log(`  Salary records: ${inserted}`)
  console.log(`  Normalisation demo: "Google India", "GOOGLE", "google" all → Company slug "google"`)
  console.log(`  Edge cases included:`)
  console.log(`    - Zero bonus: Amazon SDE-I Pune`)
  console.log(`    - Zero stock: Meta Data Analyst Mumbai`)
  console.log(`    - Zero bonus + zero stock (TC = base): Razorpay DevOps SDE-I`)
  console.log(`    - Very high equity: NVIDIA Staff MLE San Francisco ($400k stock)`)
  console.log(`    - PRINCIPAL level (single record): Microsoft Principal Engineer Hyderabad`)
  console.log(`    - GBP currency: Microsoft L5 London`)
  console.log(`    - USD currency: Google L5 SF, Meta L6 SF, NVIDIA STAFF SF`)
  console.log('──────────────────────────────────────────────────────────\n')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
