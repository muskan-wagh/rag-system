import dotenv from 'dotenv'
dotenv.config()
for (let i = 1; i <= 5; i++) {
  const t0 = Date.now()
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.QWEN_API_KEY}`, 'X-Title': 'test' },
    body: JSON.stringify({ model: process.env.QWEN_MODEL, messages: [{ role: 'user', content: `Say hello ${i}` }], max_tokens: 20 }),
  })
  const body = await res.json()
  const retryAfter = body?.error?.metadata?.retry_after_seconds ?? body?.error?.message?.slice(0,40)
  console.log(`call ${i}: status=${res.status} after=${Date.now()-t0}ms`, typeof retryAfter === 'string' ? retryAfter : `retry=${retryAfter}s`)
  await new Promise(r => setTimeout(r, 1500))
}
