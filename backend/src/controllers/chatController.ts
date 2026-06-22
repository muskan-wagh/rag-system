import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { chatCompletion } from '@/services/llm/client';
import { logger } from '@/utils/logger';

const SYSTEM_PROMPT = `You are a recruitment assistant helping a recruiter find and evaluate candidates.
You have access to a candidate discovery system that can search, rank, and compare candidates against job descriptions.

Your capabilities:
- Answer questions about the candidate search process
- Explain ranking methodology (skills 40%, experience 35%, education 25%)
- Help craft better job descriptions for better candidate matching
- Provide recruitment best practices
- Interpret ranking results

Be concise, professional, and helpful.`;

export const chatHandler = asyncHandler(async (req: Request, res: Response) => {
  const { message, context } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({
      success: false,
      error: 'message is required and must be a string',
    });
    return;
  }

  logger.info('Chat request received', { messageLength: message.length });

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  if (context?.jdText) {
    messages.push({
      role: 'system',
      content: `The recruiter is currently working with this job description:\n${context.jdText}`,
    });
  }

  if (context?.candidateIds?.length) {
    messages.push({
      role: 'system',
      content: `They are looking at these candidate IDs: ${context.candidateIds.join(', ')}`,
    });
  }

  messages.push({ role: 'user', content: message });

  const response = await chatCompletion(messages, {
    temperature: 0.7,
    maxTokens: 2048,
  });

  res.status(200).json({
    success: true,
    data: { reply: response.content },
  });
});
