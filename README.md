# AI-Powered Candidate Discovery & Ranking Engine (RAG System)

A full-stack **Retrieval-Augmented Generation (RAG)** application built for the **INDIA RUNS Challenge**. Recruiters can paste a job description and get semantically matched, intelligently ranked candidate results with explainable scores.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [System Flow](#system-flow)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Backend API](#backend-api)
- [Scoring & Ranking System](#scoring--ranking-system)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
 
---

## Architecture Overview

```
┌─────────────────┐     ┌───────────────────────────────┐     ┌─────────────────┐
│   Next.js 16    │────▶│   Express.js Backend (API)    │────▶│   Qdrant        │
│   Frontend      │     │   :5000                       │     │   Vector DB      │
│   :3000         │◀────│                               │◀────│   (Cloud)        │
└─────────────────┘     │   ┌───────────────────┐       │     └─────────────────┘
                        │   │  LLM Service       │◀────▶│  OpenRouter API
                        │   │  (OpenRouter)      │       └────────────────────
                        │   └───────────────────┘
                        │   ┌───────────────────┐
                        │   │  Ranking Engine    │
                        │   │  (Skills 40%       │
                        │   │   Exp     35%       │
                        │   │   Edu     25%)      │
                        │   └───────────────────┘
                        │   ┌───────────────────┐
                        │   │  In-Memory Cache   │
                        │   │  (5 min TTL)       │
                        │   └───────────────────┘
                        └───────────────────────────────┘
```

### RAG Pattern

1. **Retrieval**: Vector search against Qdrant using `Xenova/all-MiniLM-L6-v2` embeddings (384-d, cosine distance).
2. **Augmentation**: Retrieved candidates are scored across 4 dimensions (semantic, skills, experience, education).
3. **Generation**: LLM (OpenRouter) parses JDs, generates comparison analyses, and explains rankings.

---

## System Flow

### Candidate Search (Main User Journey)

```
User pastes JD in UI
        │
        ▼
[candidates/page.tsx]  ──POST──▶  /api/candidates/search
                                        │
                              ┌─────────┴──────────┐
                              ▼                     ▼
                        parseJD(jdText)      generateEmbedding(jdText)
                              │                     │
                        LLM extracts:          Local embedding
                        title, skills,         (Xenova/all-MiniLM-L6-v2)
                        experience,
                        education, etc.
                              │                     │
                              └──────┬──────────────┘
                                     ▼
                           searchByEmbedding()
                                     │
                           Qdrant cosine similarity
                           (with optional filters)
                                     │
                                     ▼
                             rankCandidates()
                                     │
                     ┌───────────────┼───────────────┐
                     ▼               ▼               ▼
               skillMatcher  experienceMatcher  educationMatcher
               (Jaccard +     (linear score     (level rank +
                coverage)     within range)      field overlap)
                     │               │               │
                     └───────────────┼───────────────┘
                                     ▼
                            finalRanker (weighted sum)
                            sem × 0.35 + skill × 0.30 + exp × 0.20 + edu × 0.15
                                     │
                                     ▼
                         Cache result (5 min TTL)
                                     │
                                     ▼
                    Return { results: RankingResult[], query: ParsedJD }
                                     │
                                     ▼
                    UI displays ranked candidates with % match,
                    skill breakdown, experience fit, education fit
```

### Compare Candidates

```
User enters JD text + candidate IDs
        │
        ▼
[compare/page.tsx]  ──POST──▶  /api/candidates/compare
                                        │
                              parseJD(jdText)
                              retrieveCandidatesByIds(ids)
                                        │
                              LLM generates comparison:
                              - Per-candidate pros/cons/verdict
                              - Overall recommendation
                                        │
                                        ▼
                    Return { comparison: CompareResult, query: ParsedJD }
```

---

## Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| **Node.js / Express.js** (v5) | REST API server |
| **TypeScript** (v6) | Type-safe development |
| **Qdrant** (js-client-rest) | Vector database (cloud) |
| **OpenRouter API** | LLM inference |
| **@xenova/transformers** | Local embeddings (all-MiniLM-L6-v2, 384-d) |
| **Winston** | Structured logging |
| **dotenv** | Environment configuration |

### Frontend
| Technology | Purpose |
|---|---|
| **Next.js** (v16, App Router) | React framework |
| **React** (v19) | UI library |
| **Tailwind CSS** (v4) | Utility-first styling |
| **shadcn/ui** + **Base UI** | Component primitives |
| **Lucide React** | Icon library |

---

## Project Structure

```
rag-system/
├── backend/
│   ├── .env                          # Environment variables (API keys, config)
│   ├── package.json                  # Dependencies and scripts
│   ├── tsconfig.json                 # TypeScript configuration
│   ├── start.js                      # Production startup (path alias register)
│   └── src/
│       ├── server.ts                 # Express entry point
│       ├── config/
│       │   └── index.ts              # Env config loader + validation
│       ├── types/
│       │   └── index.ts              # TypeScript interfaces
│       ├── utils/
│       │   ├── logger.ts             # Winston logger setup
│       │   ├── asyncHandler.ts       # Async route error wrapper
│       │   └── cache.ts              # In-memory TTL cache
│       ├── middleware/
│       │   ├── logger.ts             # Request logging middleware
│       │   └── errorHandler.ts       # Global error handler + AppError
│       ├── routes/
│       │   ├── index.ts              # Route aggregator
│       │   ├── jdRoutes.ts           # POST /api/jd/parse
│       │   └── candidateRoutes.ts    # POST /search, /compare, /batch; GET /:id
│       ├── controllers/
│       │   ├── jdController.ts       # JD parsing orchestration
│       │   └── candidateController.ts # Search/compare orchestration + caching
│       └── services/
│           ├── llm/
│           │   ├── client.ts         # OpenAI/OpenRouter API client (retry logic)
│           │   ├── parseJD.ts        # LLM-based JD text → structured fields
│           │   ├── compareCandidates.ts # LLM-based candidate comparison
│           │   └── explainRanking.ts # LLM-based ranking explanation
│           ├── qdrant/
│           │   ├── client.ts         # Qdrant DB client singleton
│           │   ├── createCollection.ts # Auto-create collection + indexes
│           │   ├── searchCandidates.ts # Vector search with filters
│           │   └── retrieveCandidates.ts # Get candidates by ID
│           └── ranking/
│               ├── skillMatcher.ts       # Jaccard + coverage skill scoring
│               ├── experienceMatcher.ts  # Years-of-experience scoring
│               ├── educationMatcher.ts   # Education level + field scoring
│               └── finalRanker.ts        # Weighted aggregation + sorting
│
├── frontend/
│   ├── package.json                  # Dependencies and scripts
│   ├── next.config.ts                # Next.js config (API proxy rewrites)
│   ├── postcss.config.mjs            # PostCSS with Tailwind v4
│   ├── eslint.config.mjs             # ESLint flat config
│   ├── components.json               # shadcn/ui configuration
│   └── src/
│       ├── lib/
│       │   ├── api.ts                # Backend API client functions
│       │   ├── constants.ts          # Route constants + API base URL
│       │   └── utils.ts              # cn() utility (clsx + tailwind-merge)
│       ├── components/
│       │   ├── nav-bar.tsx           # Top navigation bar
│       │   └── ui/                   # shadcn/ui component primitives
│       │       ├── badge.tsx
│       │       ├── button.tsx
│       │       ├── card.tsx
│       │       ├── input.tsx
│       │       ├── navigation-menu.tsx
│       │       ├── scroll-area.tsx
│       │       ├── select.tsx
│       │       ├── separator.tsx
│       │       ├── sheet.tsx
│       │       └── skeleton.tsx
│       └── app/
│           ├── globals.css           # Tailwind v4 + CSS variables (dark/light)
│           ├── layout.tsx            # Root layout (fonts, NavBar)
│           ├── page.tsx              # Home page (feature cards)
│           ├── candidates/
│           │   ├── page.tsx          # JD search + ranked results
│           │   └── [id]/
│           │       └── page.tsx      # Candidate detail page
│           └── compare/
│               └── page.tsx          # Multi-candidate comparison
│
└── docs/                              # (empty — for future docs)
```

---

## Backend API

All endpoints are prefixed with `/api`. The frontend proxies `/api/*` to `http://localhost:5000/api/*`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check (`{ status, timestamp }`) |
| `POST` | `/api/jd/parse` | Parse a JD into structured fields |
| `POST` | `/api/candidates/search` | Search & rank candidates for a JD |
| `POST` | `/api/candidates/compare` | Compare 2+ candidates for a JD |
| `POST` | `/api/candidates/batch` | Get multiple candidates by IDs |
| `GET` | `/api/candidates/:id` | Get a single candidate by ID |

### Request/Response Examples

**POST /api/candidates/search**
```json
{
  "jdText": "We are looking for a Senior Software Engineer...",
  "limit": 10,
  "filters": {
    "minExperience": 3,
    "maxExperience": 10,
    "skills": ["Python", "React"],
    "educationLevel": "bachelor"
  }
}
```
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "candidate": { "id": "c001", "name": "John Doe", ... },
        "scores": { "skill": 0.85, "experience": 0.9, "education": 0.75, "overall": 0.8425 },
        "explanation": "John has 85% skill overlap..."
      }
    ],
    "query": {
      "title": "Senior Software Engineer",
      "skills": ["Python", "React", "AWS"],
      "experience": { "min": 3, "max": 10 },
      "education": { "level": "bachelor", "field": "computer science" },
      "responsibilities": ["...", "..."],
      "requirements": ["...", "..."],
      "rawText": "..."
    }
  }
}
```

---

## Scoring & Ranking System

Candidates are scored across 4 dimensions, weighted and aggregated:

| Dimension | Weight | Method |
|---|---|---|
| **Semantic** | 35% | Cosine similarity of vector embeddings (JD vs candidate) |
| **Skills** | 30% | Jaccard similarity + coverage of required vs. candidate skills |
| **Experience** | 20% | Linear scoring within the JD's experience range (penalty below min, bonus above max) |
| **Education** | 15% | Level rank comparison (PhD > Master > Bachelor > Diploma) + field overlap bonus |

**Final Score** = `semanticScore × 0.35 + skillScore × 0.30 + experienceScore × 0.20 + educationScore × 0.15`

Each sub-score is 0–1, so the overall score is also 0–1.

---

## Setup & Installation

### Prerequisites

- **Node.js** v18+
- **npm**
- **Qdrant Cloud** instance (URL + API key)
- **OpenRouter** API key (or any OpenAI-compatible API)

### Backend Setup

```bash
cd rag-system/backend

# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your keys:
#   OPENAI_API_KEY=sk-or-v1-...
#   QDRANT_URL=https://xxxx.aws.cloud.qdrant.io
#   QDRANT_API_KEY=eyJhbGci...

# 3. Development mode (hot-reload)
npm run dev

# 4. Production mode
npm run build
npm start
```

### Frontend Setup

```bash
cd rag-system/frontend

# 1. Install dependencies
npm install

# 2. Run dev server
npm run dev

# 3. Open http://localhost:3000
```

Both servers must run simultaneously. The frontend proxies `/api/*` requests to the backend.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Required | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | — | ✅ | OpenRouter/OpenAI API key |
| `OPENAI_MODEL` | `gpt-oss-120b` | | LLM model for chat completions |
| `QDRANT_URL` | — | ✅ | Qdrant cloud instance URL |
| `QDRANT_API_KEY` | — | ✅ | Qdrant API key |
| `QDRANT_COLLECTION_NAME` | `candidates` | | Qdrant collection name |
| `PORT` | `5000` | | Backend server port |
| `NODE_ENV` | `development` | | `development` or `production` |
| `CLIENT_URL` | `http://localhost:3000` | | Frontend URL (CORS origin) |

### Hardcoded Configuration (`backend/src/config/index.ts`)

| Setting | Value |
|---|---|
| LLM base URL | `https://openrouter.ai/api/v1` |
| Embedding model | `Xenova/all-MiniLM-L6-v2` |
| Embedding dimensions | 384 |
| Vector distance | Cosine |
| LLM temperature (parse) | 0.1 |
| LLM temperature (compare) | 0.3 |
| LLM max tokens | 4096 (default), 2048 (compare), 512 (explain) |
| Cache TTL | 300000 ms (5 minutes) |
| LLM retry attempts | 3 (exponential backoff) |

---

## Scripts

### Backend

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `tsnd --respawn src/server.ts` | Dev server with hot-reload |
| `npm run build` | `tsc` | Compile TypeScript → JavaScript |
| `npm start` | `node start.js` | Run compiled production server |
### Frontend

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `next dev` | Dev server with Turbopack |
| `npm run build` | `next build` | Production build |
| `npm start` | `next start` | Start production server |
| `npm run lint` | `next lint` | ESLint check |

---

---

## Caching

The backend uses an in-memory **TTL cache** (`backend/src/utils/cache.ts`) to avoid redundant LLM calls:

- **JD Parse results** are cached by MD5 hash of the raw JD text.
- **Search results** are cached by MD5 hash of the search request.
- **TTL**: 5 minutes (configurable via `CACHE_TTL_MS` in config).
- Eviction: entries are lazily evicted on read when expired.

---

## Key Design Decisions

- **Layered architecture**: Routes → Controllers → Services (LLM / Qdrant / Ranking) — clear separation of concerns.
- **Async error handling**: All async routes are wrapped with `asyncHandler` which forwards errors to the global error handler.
- **Structured errors**: `AppError` class with HTTP status code, message, and optional `details` field.
- **Structured logging**: Winston logger writes colorized console output in development and JSON + file output in production.
- **Config validation**: Required env vars are validated at startup — the server refuses to start if any are missing.
- **LLM retry logic**: 3 attempts with exponential backoff for rate-limited or failed LLM calls.
- **Frontend proxy**: Next.js rewrites `/api/*` → backend, avoiding CORS issues in development.