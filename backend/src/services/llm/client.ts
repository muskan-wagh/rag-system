import { config } from '@/config';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';

interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMRequestOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  model?: string;
}

interface LLMResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface ChatCompletionChoice {
  message: { content: string };
}

interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: ChatCompletionChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const BASE_URL = config.openai.baseUrl;

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number = 2,
): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429 && attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        logger.warn(`Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      return response;
    } catch (error: any) {
      if (error.name === 'AbortError' || attempt === retries - 1) throw error;
      const delay = Math.pow(2, attempt) * 500;
      logger.warn(`Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new AppError('Max retries exceeded', 503, ErrorCodes.AI_ERROR);
}

export async function chatCompletion(
  messages: LLMMessage[],
  options: LLMRequestOptions = {},
): Promise<LLMResponse> {
  const { temperature = 0.1, maxTokens = 4096, stream = false, model } = options;
  const resolvedModel = model || config.openai.model;

  const startTime = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45_000);

  let response: Response;
  try {
    response = await fetchWithRetry(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openai.apiKey}`,
        'HTTP-Referer': config.clientUrl,
        'X-Title': 'Candidate Discovery Engine',
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new AppError(
      `LLM request failed: ${response.status} ${response.statusText}`,
      response.status,
      ErrorCodes.AI_ERROR,
      errorBody,
    );
  }

  const data = (await response.json()) as ChatCompletionResponse;

  const duration = Date.now() - startTime;
  const usage = data.usage;
  logger.info('LLM request completed', {
    model: data.model,
    durationMs: duration,
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
    reasoningTokens: (usage as any).completion_tokens_details?.reasoning_tokens ?? 0,
  });

  return {
    content: data.choices[0].message.content,
    model: data.model,
    usage: {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    },
  };
}
