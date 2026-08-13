import dotenv from 'dotenv'; dotenv.config()
const key = process.env.QWEN_API_KEY
const model = process.env.QWEN_MODEL || 'openai/gpt-oss-20b:free'
const t0 = Date.now()
const controller = new AbortController()
const timer = setTimeout(() => controller.abort(), 60000)
try {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`, 'X-Title': 'test' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Say hi' }], max_tokens: 50 }),
    signal: controller.signal,
  })
  console.log('status', res.status, 'after', Date.now() - t0, 'ms')
  const text = await res.text()
  console.log('body', text.slice(0, 300))
} catch (e) {
  console.log('ERROR', e.name, e.message, 'after', Date.now() - t0, 'ms')
} finally {
  clearTimeout(timer)
}
