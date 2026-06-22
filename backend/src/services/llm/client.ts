import { config } from '@/config';
import { logger } from '@/utils/logger';

interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMRequestOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
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

interface EmbeddingData {
  embedding: number[];
}

interface EmbeddingResponse {
  model: string;
  data: EmbeddingData[];
}

const BASE_URL = config.openai.baseUrl;

class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number = 3,
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
    } catch (error) {
      if (attempt === retries - 1) throw error;
      const delay = Math.pow(2, attempt) * 500;
      logger.warn(`Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new AppError('Max retries exceeded', 503);
}

export async function chatCompletion(
  messages: LLMMessage[],
  options: LLMRequestOptions = {},
): Promise<LLMResponse> {
  const { temperature = 0.1, maxTokens = 4096, stream = false } = options;

  const startTime = Date.now();

  const response = await fetchWithRetry(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.openai.apiKey}`,
      'HTTP-Referer': config.clientUrl,
      'X-Title': 'Candidate Discovery Engine',
    },
    body: JSON.stringify({
      model: config.openai.model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new AppError(
      `LLM request failed: ${response.status} ${response.statusText}`,
      response.status,
      errorBody,
    );
  }

  const data = (await response.json()) as ChatCompletionResponse;

  const duration = Date.now() - startTime;
  logger.debug(`LLM request completed in ${duration}ms`, {
    model: data.model,
    usage: data.usage,
  });

  return {
    content: data.choices[0].message.content,
    model: data.model,
    usage: {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    },
  };
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const startTime = Date.now();

  const response = await fetchWithRetry(`${BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.openai.apiKey}`,
      'HTTP-Referer': config.clientUrl,
      'X-Title': 'Candidate Discovery Engine',
    },
    body: JSON.stringify({
      model: config.openai.embeddingModel,
      input: text,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new AppError(
      `Embedding request failed: ${response.status} ${response.statusText}`,
      response.status,
      errorBody,
    );
  }

  const data = (await response.json()) as EmbeddingResponse;

  const duration = Date.now() - startTime;
  logger.debug(`Embedding request completed in ${duration}ms`, {
    model: data.model,
    dimensions: data.data[0].embedding.length,
  });

  return data.data[0].embedding;
}

export { AppError };
