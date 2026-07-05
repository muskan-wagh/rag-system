"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function required(key) {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}
function optional(key, defaultValue) {
    return process.env[key] ?? defaultValue;
}
exports.config = Object.freeze({
    port: parseInt(optional("PORT", "5000"), 10),
    nodeEnv: optional("NODE_ENV", "development"),
    clientUrl: optional("CLIENT_URL", "http://localhost:3000"),
    allowedOrigins: (() => {
        // Allow overriding via CORS_ORIGINS env var (comma-separated)
        const envOrigins = optional("CORS_ORIGINS", "");
        if (envOrigins) {
            return envOrigins.split(",").map((s) => s.trim());
        }
        const origins = ["https://rag-system-vert.vercel.app"];
        if (optional("NODE_ENV", "development") === "development") {
            origins.push("http://localhost:3000", "http://localhost:3001");
        }
        return origins;
    })(),
    supabase: {
        url: required("SUPABASE_URL"),
        serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    },
    openai: {
        apiKey: required("QWEN_API_KEY"),
        model: optional("QWEN_MODEL", "qwen/qwen3-next-80b-a3b-instruct"),
        baseUrl: "https://openrouter.ai/api/v1",
        embeddingModel: "text-embedding-3-small",
    },
    qdrant: {
        url: required("QDRANT_URL"),
        apiKey: required("QDRANT_API_KEY"),
        collectionName: optional("QDRANT_COLLECTION_NAME", "candidates"),
        vectorSize: 1536,
        distance: "Cosine",
    },
});
//# sourceMappingURL=index.js.map