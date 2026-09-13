import crypto from 'crypto';
import { chatCompletion } from './client';
import { logger } from '@/utils/logger';
import { getCached, setCache } from '@/utils/cache';

const CACHE_TTL = 300_000;

export interface OutreachContext {
  candidateName: string;
  skills: string[];
  experienceYears?: number;
  currentTitle?: string;
  currentCompany?: string;
  projects: Array<{ name?: string; description?: string; technologies?: string[] }>;
  workHistory: Array<{ company?: string; title?: string; duration?: string }>;
  summary?: string;
  targetRole: string;
  jobDescription: string;
  companyName?: string;
  recruiterName?: string;
}

function cacheKey(candidateName: string, targetRole: string, jdHash: string): string {
  const hash = crypto.createHash('md5').update(`${candidateName}|${targetRole}|${jdHash}`).digest('hex');
  return `outreach:${hash}`;
}

function clampList(items: string[], max = 8): string[] {
  return items.map((s) => s.trim()).filter(Boolean).slice(0, max);
}

export async function generateOutreachEmail(ctx: OutreachContext): Promise<{ subject: string; body: string }> {
  const jdHash = crypto.createHash('md5').update(ctx.jobDescription || ctx.targetRole).digest('hex');
  const key = cacheKey(ctx.candidateName, ctx.targetRole, jdHash);
  const cached = await getCached<{ subject: string; body: string }>(key);
  if (cached?.subject && cached?.body) {
    logger.info('Outreach email cache hit');
    return cached;
  }

  const skills = clampList(ctx.skills).join(', ') || 'Not specified';
  const projects = ctx.projects.slice(0, 3).map((p) => {
    const tech = Array.isArray(p.technologies) ? ` (${p.technologies.slice(0, 5).join(', ')})` : '';
    const desc = p.description ? `: ${String(p.description).slice(0, 220)}` : '';
    return `- ${p.name || 'Project'}${tech}${desc}`;
  }).join('\n') || 'None listed';
  const work = ctx.workHistory.slice(0, 4).map((w) =>
    `- ${w.title || 'Role'} at ${w.company || 'Company'}${w.duration ? ` (${w.duration})` : ''}`,
  ).join('\n') || 'None listed';

  const companyLine = ctx.companyName ? ` at ${ctx.companyName}` : '';
  const recruiterLine = ctx.recruiterName ? ctx.recruiterName : 'Talent Team';

  const prompt = `You are a professional recruiter writing a personalized candidate outreach email.

STRICT RULES:
- Use ONLY the candidate facts provided below. Never invent skills, experience, projects, companies, or titles.
- If a fact is missing, omit it gracefully — never fabricate.
- Never mention or hint at any internal match score, ranking, or AI evaluation.
- Keep it warm, concise (150-220 words body), and professional.

Candidate:
- Name: ${ctx.candidateName}
- Current: ${ctx.currentTitle || 'Not specified'}${ctx.currentCompany ? ` at ${ctx.currentCompany}` : ''}
- Experience: ${ctx.experienceYears ?? 'Not specified'} years
- Skills: ${skills}
- Summary: ${(ctx.summary || '').slice(0, 600) || 'Not specified'}
- Work history:
${work}
- Projects:
${projects}

Opportunity:
- Target role: ${ctx.targetRole}${companyLine}
- Job description (excerpt): ${(ctx.jobDescription || '').slice(0, 1500) || 'Not specified'}
- Hiring company: ${ctx.companyName || 'Not specified'}

Write:
1. Subject line starting with "Opportunity" and including the role${ctx.companyName ? ' and company' : ''} (no placeholders, no brackets).
2. Email body: greet ${ctx.candidateName} by first name, reference 2-3 of their REAL skills/experience/projects, connect to the role, one short paragraph on the opportunity, clear low-friction call to action (reply / 15-min chat), sign as "${recruiterLine}".

Return format exactly:
Subject: <subject>
Body:
<body>`;

  logger.info('Generating outreach email', { candidate: ctx.candidateName, role: ctx.targetRole });

  const response = await chatCompletion([
    { role: 'system', content: 'You are a professional recruiter who writes concise, factual, personalized outreach emails. You never invent facts.' },
    { role: 'user', content: prompt },
  ], { temperature: 0.4, maxTokens: 1024 });

  const text = response.content || '';
  const subjectMatch = text.match(/^subject:\s*(.+)$/im);
  const bodySplit = text.split(/^\s*body:\s*$/im);
  let subject = (subjectMatch?.[1] || '').trim();
  let body = (bodySplit.length > 1 ? bodySplit.slice(1).join('Body:') : text).trim();
  // Strip accidental markdown fences
  body = body.replace(/^```[a-z]*\n/i, '').replace(/\n```\s*$/, '').trim();
  if (!subject) subject = `Opportunity: ${ctx.targetRole}${companyLine}`;
  if (!body) body = text.trim();

  const result = { subject: subject.slice(0, 200), body: body.slice(0, 6000) };
  await setCache(key, result, CACHE_TTL).catch(() => {});
  return result;
}
