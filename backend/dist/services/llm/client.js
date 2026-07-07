"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatCompletion = chatCompletion;
const config_1 = require("@/config");
const logger_1 = require("@/utils/logger");
const errorHandler_1 = require("@/middleware/errorHandler");
const errorCodes_1 = require("@/middleware/errorCodes");
const BASE_URL = config_1.config.openai.baseUrl;
async function fetchWithRetry(url, options, retries = 3) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (response.status === 429 && attempt < retries - 1) {
                const delay = Math.pow(2, attempt) * 1000;
                logger_1.logger.warn(`Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
                await new Promise((resolve) => setTimeout(resolve, delay));
                continue;
            }
            return response;
        }
        catch (error) {
            if (attempt === retries - 1)
                throw error;
            const delay = Math.pow(2, attempt) * 500;
            logger_1.logger.warn(`Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    throw new errorHandler_1.AppError('Max retries exceeded', 503, errorCodes_1.ErrorCodes.AI_ERROR);
}
async function chatCompletion(messages, options = {}) {
    const { temperature = 0.1, maxTokens = 4096, stream = false } = options;
    const startTime = Date.now();
    const response = await fetchWithRetry(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config_1.config.openai.apiKey}`,
            'HTTP-Referer': config_1.config.clientUrl,
            'X-Title': 'Candidate Discovery Engine',
        },
        body: JSON.stringify({
            model: config_1.config.openai.model,
            messages,
            temperature,
            max_tokens: maxTokens,
            stream,
        }),
    });
    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new errorHandler_1.AppError(`LLM request failed: ${response.status} ${response.statusText}`, response.status, errorCodes_1.ErrorCodes.AI_ERROR, errorBody);
    }
    const data = (await response.json());
    const duration = Date.now() - startTime;
    logger_1.logger.debug(`LLM request completed in ${duration}ms`, {
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
//# sourceMappingURL=client.js.map