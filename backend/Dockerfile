# Multi-stage build for the HireStack backend.
#
# The model pre-download step (below) bakes the ONNX embedding model into the
# image so cold starts never re-download it from Hugging Face (~23MB).
#
# Build context = repository root (Render docker runtime uses the repo root).
# The same image serves both the API web service (`node start.js`) and the
# worker service (`node start-workers.js`) via startCommand override.

# ---- Build stage ----
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Install deps (includes onnxruntime-node, which needs glibc -> bookworm-slim)
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# Pre-download the embedding model into the transformers FS cache
# (node_modules/@xenova/transformers/.cache) so it is baked into the image.
# Best-effort: if Hugging Face is unreachable during build, the app still works
# and lazy-downloads at runtime instead.
RUN node -e "
  const { pipeline } = require('@xenova/transformers');
  pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true })
    .then((m) => m('HireStack model warmup', { pooling: 'mean', normalize: true }))
    .then(() => console.log('Embedding model cached in image'))
    .catch((e) => console.error('Model pre-download failed (will lazy-load at runtime):', e.message))
    .finally(() => process.exit(0));
" || true

# ---- Runtime stage ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY backend/package.json ./
COPY backend/start.js \
     backend/start-worker.js \
     backend/start-email-worker.js \
     backend/start-workers.js \
     backend/start-all.js ./

EXPOSE 5000

CMD ["node", "start.js"]