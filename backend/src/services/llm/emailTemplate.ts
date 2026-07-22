import crypto from 'crypto';
import { chatCompletion } from './client';
import { logger } from '@/utils/logger';
import { getCached, setCache } from '@/utils/cache';

const CACHE_TTL = 300_000;

function cacheKey(candidateName: string, jobTitle: string): string {
  const hash = crypto.createHash('md5').update(candidateName + jobTitle).digest('hex');
  return `email:${hash}`;
}

export async function generateInterviewEmail(
  candidateName: string,
  jobTitle: string,
  candidateInfo: string,
): Promise<string> {
  const key = cacheKey(candidateName, jobTitle);

  const cached = await getCached<string>(key);
  if (cached) {
    logger.info('Email template cache hit');
    return cached;
  }
  logger.info('Generating interview email template', { candidate: candidateName, jobTitle });

  const prompt = `You are a professional recruiter writing an interview invitation email.

Details:
- Candidate Name: ${candidateName}
- Job Title: ${jobTitle}
- Candidate Info: ${candidateInfo}

Write a warm, professional interview invitation email to ${candidateName}. Include:
1. A friendly greeting and excitement about their application
2. Confirmation of the role they're being considered for (${jobTitle})
3. What they can expect during the interview process
4. A request to confirm their availability
5. Professional closing with contact information

Make it concise (4-5 paragraphs), warm, and professional. Sign it as "RecruitIQ Talent Team".`;

  const response = await chatCompletion([
    { role: 'system', content: 'You are a professional recruitment coordinator who writes clear, warm interview invitation emails.' },
    { role: 'user', content: prompt },
  ], { temperature: 0.3, maxTokens: 1024 });

  await setCache(key, response.content, CACHE_TTL).catch(() => {});
  return response.content;
}
