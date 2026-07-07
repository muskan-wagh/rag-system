import dotenv from "dotenv";

dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const config = Object.freeze({
  port: parseInt(optional("PORT", "5000"), 10),
  nodeEnv: optional("NODE_ENV", "development"),
  clientUrl: optional("CLIENT_URL", "http://localhost:3000"),
  allowedOrigins: (() => {
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
  },

  embedding: {
    model: optional("EMBEDDING_MODEL", "Xenova/all-MiniLM-L6-v2"),
    vectorSize: 384,
    distance: "Cosine" as const,
  },

  redis: {
    url: required("REDIS_URL"),
  },

  apiKey: optional("API_KEY", ""),
  recruiterPassword: required("RECRUITER_PASSWORD"),

  qdrant: {
    url: required("QDRANT_URL"),
    apiKey: required("QDRANT_API_KEY"),
    collectionName: optional("QDRANT_COLLECTION_NAME", "candidates"),
    vectorSize: 384,
    distance: "Cosine" as const,
  },
});
