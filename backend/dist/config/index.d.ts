export declare const config: Readonly<{
    port: number;
    nodeEnv: string;
    clientUrl: string;
    openai: {
        apiKey: string;
        model: string;
        baseUrl: string;
        embeddingModel: string;
    };
    qdrant: {
        url: string;
        apiKey: string;
        collectionName: string;
        vectorSize: number;
        distance: "Cosine";
    };
}>;
//# sourceMappingURL=index.d.ts.map