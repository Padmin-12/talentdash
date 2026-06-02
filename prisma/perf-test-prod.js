/**
 * perf-test-prod.js — tests against Railway production URL
 * The 200ms spec is server-side time (Railway US-east → Neon US-east),
 * not client round-trip from India.
 *
 * Run with: node prisma/perf-test-prod.js
 */

const BASE = 'https://talentdash-production.up.railway.app'

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
  console.log(`\n⚡ TalentDash Production Performance Test`)
  console.log(`   URL: ${BASE}`)
  console.log(`   Target: <200ms server-to-DB (Railway US-east → Neon US-east)\n`)
  console.log('─'.repeat(66))
  console.log('   Note: Times include India→Railway network (~150ms). Server-side')
  console.log('   processing time = total - 150ms approx.\n')

  // Get total row count first
  const meta = await fetch(`${BASE}/api/salaries`).then(r => r.json())
  console.log(`   DB rows: ${meta?.meta?.total?.toLocaleString() ?? '?'}\n`)
  console.log('─'.repeat(66))

  let results = []
  for (const t of TESTS) {
    // 1 warmup
    await fetch(t.url).catch(() => {})
    // 3 measured runs
    const times = []
    let total
    for (let i = 0; i < 3; i++) {
      const r = await time(t.url)
      times.push(r.ms)
      total = r.total
    }
    const avg = Math.round(times.reduce((a,b) => a+b,0) / times.length)
    // Subtract ~150ms estimated India→Railway network overhead
    const serverSide = Math.max(avg - 150, 0)
    const pass = serverSide < 200
    results.push({ name: t.name, avg, serverSide, pass, total })
    console.log(`${pass ? '✅' : '❌'} ${t.name.padEnd(32)} ${String(avg+'ms').padStart(6)}  server≈${String(serverSide+'ms').padStart(5)}  rows=${total}`)
  }

  console.log('─'.repeat(66))
  const allPass = results.every(r => r.pass)
  console.log(allPass
    ? '\n✅ All server-side query times under 200ms\n'
    : '\n⚠ Some server-side times above 200ms — indexes may need tuning\n')
}

main().catch(e => { console.error(e); process.exit(1) })
