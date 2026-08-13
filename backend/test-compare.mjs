import dotenv from 'dotenv'
dotenv.config()
const headers = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` }
const url = process.env.SUPABASE_URL.replace(/\/$/, '')
const q = (p) => fetch(`${url}/rest/v1/${p}`, { headers }).then(r => r.json())
const cands = await q(`candidates?select=id,full_name,current_title,current_company,total_experience_years,resume_file_url&full_name=in.("Alice Johnson","Jane Smith")`)
const skills = await q(`candidate_skills?select=candidate_id,skill_name&candidate_id=in.(${(cands.map(c=>c.id)).join(',')})`)
const skillMap = {}
for (const s of skills) { (skillMap[s.candidate_id] ||= []).push(s.skill_name) }
const candidates = cands.map(c => ({ id: c.id, name: c.full_name, skills: skillMap[c.id] || [], experience: c.total_experience_years, education: { level: 'Bachelor', field: '' }, summary: 'Summary placeholder. Candidate is a developer with prior roles.' }))

const jd = { title: 'Senior Fullstack Engineer', skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'AWS'], experience: { min: 5, max: 8 }, education: { level: 'Bachelor', field: '' }, responsibilities: ['Build and scale web applications'], requirements: ['5+ years experience', 'Systems design', 'AWS'] }

const candidatesText = candidates.map((c, i) => `
Candidate ${i + 1} (ID: ${c.id}):
Name: ${c.name}
Skills: ${c.skills.join(', ')}
Experience: ${c.experience} years
Education: ${c.education.level} in ${c.education.field}
Summary: ${c.summary}
`).join('\n---\n')

const prompt = `Job Description Title: ${jd.title}
Required Skills: ${jd.skills.join(', ')}
Required Experience: ${jd.experience.min}-${jd.experience.max} years
Required Education: ${jd.education.level} in ${jd.education.field}
Responsibilities: ${jd.responsibilities.join(', ')}
Requirements: ${jd.requirements.join(', ')}

Candidates:
${candidatesText}

Compare these candidates for this role.`

const system = `You are a senior recruitment analyst comparing candidates for a specific role.\nGiven a job description and multiple candidate profiles, produce a structured analysis.\nReturn ONLY valid JSON. No markdown, no code fences, no extra text. No trailing commas.\nSchema: { "comparisons": [ { "candidateId": "uuid", "scores": { "overall": 0-100, "technical": 0-100, "experience": 0-100, "education": 0-100, "culture": 0-100, "leadership": 0-100, "communication": 0-100 }, "strengths": ["string"], "weaknesses": ["string"], "missingSkills": [], "risks": [], "verdict": "string" } ], "recommendation": { "candidateId": "uuid", "reasoning": "string" }, "summary": "string", "interviewQuestions": [], "skillOverlap": { "shared": [], "unique": {} } }`

const t0 = Date.now()
const controller = new AbortController()
const timer = setTimeout(() => controller.abort(), 90000)
try {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.QWEN_API_KEY}`, 'X-Title': 'test' },
    body: JSON.stringify({ model: process.env.QWEN_MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], temperature: 0.1, max_tokens: 4096 }),
    signal: controller.signal,
  })
  console.log('status', res.status, 'after', Date.now() - t0, 'ms')
  const text = await res.text()
  console.log('len', text.length)
  console.log(text.slice(0, 200).replace(/\n/g, ' '))
  console.log('...tail...', text.slice(-150).replace(/\n/g, ' '))
} catch (e) {
  console.log('ERROR', e.name, e.message, 'after', Date.now() - t0, 'ms')
} finally {
  clearTimeout(timer)
}
