import dotenv from "dotenv";

if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

const REQUIRED_VARS = ["REDIS_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "QWEN_API_KEY", "QDRANT_URL", "QDRANT_API_KEY", "CLERK_SECRET_KEY"];
for (const v of REQUIRED_VARS) {
  console.log(`[startup] ${v}: ${process.env[v] ? "present" : "MISSING"}`);
}
console.log(`[startup] NODE_ENV: ${process.env.NODE_ENV ?? "MISSING"}`);
console.log(`[startup] CWD: ${process.cwd()}`);

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
  clerkSecretKey: required("CLERK_SECRET_KEY"),
  allowedOrigins: (() => {
    const parseList = (raw: string): string[] =>
      raw
        .split(',')
        .map((s) => s.trim().replace(/\/+$/, ''))
        .filter(Boolean);
    const origins = new Set<string>();
    // Env-based configuration takes precedence and is merged with defaults
    // so CLIENT_URL is never silently dropped when CORS_ORIGINS is set.
    for (const o of parseList(optional('CORS_ORIGINS', ''))) origins.add(o);
    const clientUrl = optional('CLIENT_URL', '').trim().replace(/\/+$/, '');
    if (clientUrl) origins.add(clientUrl);
    if (optional('NODE_ENV', 'development') === 'development') {
      origins.add('http://localhost:3000');
      origins.add('http://localhost:3001');
    }
    if (optional('NODE_ENV', 'development') === 'production') {
      origins.add('https://hirestack-vert.vercel.app');
    }
    return [...origins];
  })(),

  supabase: {
    url: required("SUPABASE_URL"),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  },

  openai: {
    apiKey: required("QWEN_API_KEY"),
    model: optional("QWEN_MODEL", "qwen/qwen-2.5-7b-instruct"),
    premiumModel: optional("QWEN_PREMIUM_MODEL", "qwen/qwen3-next-80b-a3b-instruct"),
    baseUrl: "https://openrouter.ai/api/v1",
  },

  embedding: {
    model: optional("EMBEDDING_MODEL", "Xenova/all-MiniLM-L6-v2"),
    vectorSize: 384,
    distance: "Cosine" as const,
    // 'local' (default, Xenova MiniLM 384-d) or 'hosted' (Hugging Face
    // Inference API for sentence-transformers/all-MiniLM-L6-v2 — same
    // model, same 384-d vectors, no Qdrant migration). Hosted failures
    // fall back to local; see services/embedding.ts. Never auto-migrated.
    provider: optional("EMBEDDING_PROVIDER", "local"),
    apiUrl: optional("EMBEDDING_API_URL", "https://router.huggingface.co/hf-inference/models"),
    apiKey: optional("EMBEDDING_API_KEY", ""),
    hostedModel: optional("EMBEDDING_HOSTED_MODEL", "sentence-transformers/all-MiniLM-L6-v2"),
  },

  resend: {
    apiKey: optional("RESEND_API_KEY", ""),
    fromEmail: optional("RESEND_FROM_EMAIL", "onboarding@resend.dev"),
  },

  redis: {
    url: required("REDIS_URL"),
  },

  qdrant: {
    url: required("QDRANT_URL"),
    apiKey: required("QDRANT_API_KEY"),
    collectionName: optional("QDRANT_COLLECTION_NAME", "candidates"),
    vectorSize: 384,
    distance: "Cosine" as const,
  },
});
