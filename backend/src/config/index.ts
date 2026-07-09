import dotenv from "dotenv";

if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

type Service = "api" | "worker" | "both";

const SERVICE_TIPS: Record<string, { service: Service; hint: string }> = {
  SUPABASE_URL: {
    service: "both",
    hint: "Find at Supabase Dashboard → Project Settings → API → Project URL",
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    service: "both",
    hint: "Find at Supabase Dashboard → Project Settings → API → service_role key",
  },
  QWEN_API_KEY: {
    service: "both",
    hint: "Your OpenRouter API key for LLM calls",
  },
  QDRANT_URL: {
    service: "both",
    hint: "Find at Qdrant Cloud → Clusters → Cluster URL",
  },
  QDRANT_API_KEY: {
    service: "both",
    hint: "Find at Qdrant Cloud → Clusters → API Key",
  },
  REDIS_URL: {
    service: "both",
    hint: "Redis connection string (Upstash or similar). Required for BullMQ queue + rate limiting.",
  },
  RECRUITER_PASSWORD: {
    service: "api",
    hint: "Password used for dashboard access. Set this to a strong, unique value.",
  },
};

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    const tip = SERVICE_TIPS[key];
    const lines = [`Missing required environment variable: ${key}`];
    if (tip) {
      lines.push(`  Required by: ${tip.service === "both" ? "API + Worker" : tip.service} service`);
      lines.push(`  Hint: ${tip.hint}`);
    }
    lines.push(`  Set this in your Render dashboard: Dashboard → your-service → Environment → add ${key}`);
    lines.push(`  Or create a .env file for local development (see .env.example)`);
    throw new Error(lines.join("\n"));
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
    const origins: string[] = [];
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
