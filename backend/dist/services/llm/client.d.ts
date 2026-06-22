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
declare class AppError extends Error {
    statusCode: number;
    details?: unknown | undefined;
    constructor(message: string, statusCode?: number, details?: unknown | undefined);
}
export declare function chatCompletion(messages: LLMMessage[], options?: LLMRequestOptions): Promise<LLMResponse>;
export declare function generateEmbedding(text: string): Promise<number[]>;
export { AppError };
//# sourceMappingURL=client.d.ts.map