// measure-rtt.js — measures pure network RTT to Railway (no DB)
const URL = 'https://talentdash-production.up.railway.app'

async function measureRTT(url, runs = 5) {
  const times = []
  for (let i = 0; i < runs; i++) {
    const t = Date.now()
    await fetch(url)
    times.push(Date.now() - t)
  }
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
  const min = Math.min(...times)
  const max = Math.max(...times)
  return { avg, min, max, times }
}

async function main() {
  console.log('\n📡 Measuring India → Railway network RTT (no DB)...')
  const { avg, min, max, times } = await measureRTT(URL)
  console.log(`\n   Runs: ${times.map(t => t + 'ms').join(', ')}`)
  console.log(`   Min: ${min}ms  Max: ${max}ms  Avg: ${avg}ms`)
  console.log(`\n   → Pure network overhead: ~${avg}ms`)
  console.log(`   → Server-side time = query_time - ${avg}ms\n`)

  // Now measure a DB query and subtract the network overhead
  console.log('📊 Actual server-side DB query times:')
  const queries = [
    ['No filters',       `${URL}/api/salaries`],
    ['USD currency',     `${URL}/api/salaries?currency=USD`],
    ['Level exact',      `${URL}/api/salaries?level=SDE_II`],
    ['All filters',      `${URL}/api/salaries?company=amazon&level=SDE_II&location=Bengaluru`],
  ]
  for (const [name, url] of queries) {
    await fetch(url) // warmup
    const t = Date.now()
    const r = await fetch(url)
    const total = Date.now() - t
    const serverSide = Math.max(total - avg, 0)
    const pass = serverSide < 200
    console.log(`   ${pass ? '✅' : '❌'} ${name.padEnd(20)} total=${total}ms  server≈${serverSide}ms`)
  }
  console.log()
}

main().catch(console.error)
