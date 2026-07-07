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
export declare function chatCompletion(messages: LLMMessage[], options?: LLMRequestOptions): Promise<LLMResponse>;
export {};
//# sourceMappingURL=client.d.ts.map