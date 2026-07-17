export declare const config: Readonly<{
    port: number;
    nodeEnv: string;
    clientUrl: string;
    clerkSecretKey: string;
    allowedOrigins: string[];
    supabase: {
        url: string;
        serviceRoleKey: string;
    };
    openai: {
        apiKey: string;
        model: string;
        baseUrl: string;
    };
    embedding: {
        model: string;
        vectorSize: number;
        distance: "Cosine";
    };
    redis: {
        url: string;
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