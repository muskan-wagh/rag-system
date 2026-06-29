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
    port: parseInt(optional('PORT', '5000'), 10),
    nodeEnv: optional('NODE_ENV', 'development'),
    clientUrl: optional('CLIENT_URL', 'http://localhost:3000'),
    allowedOrigins: [
        'http://localhost:3000',
        'https://recruitflow-blond.vercel.app',
    ],
    openai: {
        apiKey: required('OPENAI_API_KEY'),
        model: optional('OPENAI_MODEL', 'gpt-oss-120b'),
        baseUrl: 'https://openrouter.ai/api/v1',
        embeddingModel: 'text-embedding-3-small',
    },
    qdrant: {
        url: required('QDRANT_URL'),
        apiKey: required('QDRANT_API_KEY'),
        collectionName: optional('QDRANT_COLLECTION_NAME', 'candidates'),
        vectorSize: 1536,
        distance: 'Cosine',
    },
});
//# sourceMappingURL=index.js.map