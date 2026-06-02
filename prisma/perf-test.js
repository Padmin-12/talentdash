/**
 * perf-test.js — run with: node prisma/perf-test.js
 * Times GET /api/salaries queries on a 10k row dataset.
 * Target: <200ms per the B3 spec.
 */

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

const TESTS = [
  { name: 'No filters (cold)',          url: `${BASE}/api/salaries` },
  { name: 'Company filter (ILIKE)',      url: `${BASE}/api/salaries?company=google` },
  { name: 'Level filter (exact)',        url: `${BASE}/api/salaries?level=SDE_II` },
  { name: 'Location (ILIKE)',            url: `${BASE}/api/salaries?location=Bengaluru` },
  { name: 'All filters combined',        url: `${BASE}/api/salaries?company=amazon&level=SDE_II&location=Bengaluru&sort=total_comp_desc` },
  { name: 'Sort TC desc limit=100',      url: `${BASE}/api/salaries?sort=total_comp_desc&limit=100` },
  { name: 'USD currency filter',         url: `${BASE}/api/salaries?currency=USD` },
  { name: 'No filters (warm)',           url: `${BASE}/api/salaries` },
]

async function time(url) {
  const t = Date.now()
  const r = await fetch(url)
  const ms = Date.now() - t
  const d = await r.json()
  return { ms, total: d?.meta?.total ?? '?' }
}

async function main() {
  console.log(`\n⚡ TalentDash Query Performance Test`)
  console.log(`   Target: <200ms per query (B3 spec)\n`)
  console.log('─'.repeat(62))

  let allPass = true

  for (const t of TESTS) {
    // 1 warmup + 3 measured runs
    await fetch(t.url).catch(() => {})
    const times = []
    let total
    for (let i = 0; i < 3; i++) {
      const r = await time(t.url)
      times.push(r.ms)
      total = r.total
    }
    const avg = Math.round(times.reduce((a,b) => a+b,0) / times.length)
    const pass = avg < 200
    if (!pass) allPass = false
    const row = t.name.padEnd(32)
    const ms  = `${avg}ms`.padStart(6)
    const tot = `(${total} rows)`.padEnd(14)
    console.log(`${pass ? '✅' : '❌'} ${row} ${ms}  ${tot} ${pass ? '' : '← SLOW'}`)
  }

  console.log('─'.repeat(62))
  console.log(allPass
    ? '\n✅ ALL QUERIES UNDER 200ms — B3 spec satisfied\n'
    : '\n❌ Some queries exceeded 200ms\n')
}

main().catch(e => { console.error(e); process.exit(1) })
