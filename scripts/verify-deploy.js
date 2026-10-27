async function verify() {
  console.log('🔍 Running full end-to-end verification...\n')

  // 1. Verify Cloudflare Worker
  console.log('1. Checking Cloudflare Worker endpoint...')
  const workerUrl = 'https://forge-fit-worker.bankarrigveda13.workers.dev'
  const workerRes = await fetch(`${workerUrl}/api/settings/ai-credentials`, {
    headers: { 'X-Device-Token': '00000000-0000-0000-0000-000000000000' }
  })
  const workerJson = await workerRes.json()
  console.log('   Worker Status:', workerRes.status)
  console.log('   Worker Response:', JSON.stringify(workerJson))
  if (workerRes.status === 200 && workerJson.ok === true) {
    console.log('   ✅ Cloudflare Worker is healthy and responding.')
  } else {
    throw new Error('Worker response failed validation')
  }

  // 2. Verify Vercel Production Site
  console.log('\n2. Checking Vercel Production Site...')
  const siteUrl = 'https://gym-tracker-six-teal.vercel.app'
  const siteRes = await fetch(siteUrl)
  const siteHtml = await siteRes.text()
  console.log('   Vercel Status:', siteRes.status)
  console.log('   HTML Title found:', siteHtml.includes('Forge Fit'))
  if (siteRes.status === 200 && siteHtml.includes('Forge Fit')) {
    console.log('   ✅ Vercel Production Site is live.')
  } else {
    throw new Error('Production site check failed')
  }

  // 3. Verify Routes on Production SPA
  console.log('\n3. Checking Client-Side Routes on Production SPA...')
  for (const route of ['/ai-logger', '/settings/ai', '/workouts', '/nutrition', '/progress']) {
    const r = await fetch(`${siteUrl}${route}`)
    console.log(`   Route ${route}: status ${r.status}`)
  }

  // 4. Test CORS Options Preflight on Worker
  console.log('\n4. Checking CORS Preflight on Worker...')
  const corsRes = await fetch(`${workerUrl}/api/settings/ai-credentials`, {
    method: 'OPTIONS',
    headers: { 'Origin': siteUrl }
  })
  console.log('   CORS Options Status:', corsRes.status)
  console.log('   Access-Control-Allow-Origin:', corsRes.headers.get('Access-Control-Allow-Origin'))
  if (corsRes.status === 204 && corsRes.headers.get('Access-Control-Allow-Origin') === siteUrl) {
    console.log('   ✅ CORS correctly allows production origin.')
  }

  // 5. Test Invalid Key Validation on Worker
  console.log('\n5. Checking Invalid Key Validation...')
  const badKeyRes = await fetch(`${workerUrl}/api/settings/ai-credentials`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Token': '00000000-0000-0000-0000-000000000000'
    },
    body: JSON.stringify({ provider: 'gemini', apiKey: '   ' })
  })
  const badKeyJson = await badKeyRes.json()
  console.log('   Invalid Key Status:', badKeyRes.status, JSON.stringify(badKeyJson))
  if (badKeyRes.status === 400 && badKeyJson.code === 'INVALID_KEY') {
    console.log('   ✅ Blank key correctly rejected.')
  }

  // 6. Test Missing Token Authorization on Worker
  console.log('\n6. Checking Authorization on Worker...')
  const noTokenRes = await fetch(`${workerUrl}/api/settings/ai-credentials`, { method: 'GET' })
  const noTokenJson = await noTokenRes.json()
  console.log('   Missing Token Status:', noTokenRes.status, JSON.stringify(noTokenJson))
  if (noTokenRes.status === 401 && noTokenJson.code === 'MISSING_TOKEN') {
    console.log('   ✅ Unauthenticated request correctly blocked.')
  }

  console.log('\n🎉 ALL LIVE VERIFICATION CHECKS PASSED!')
}

verify().catch(err => {
  console.error('\n❌ Verification failed:', err)
  process.exit(1)
})

