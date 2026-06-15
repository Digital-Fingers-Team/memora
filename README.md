# Memora

Memora is an AI-powered Thinking OS for capturing, structuring, connecting, and reusing personal knowledge.

It is designed for knowledge compounding, not passive storage. Every captured note, transcript, URL, decision, lesson, project update, or idea becomes a structured Knowledge Object that can be searched, linked, surfaced, and reused by the assistant when the user thinks through future work.

## Highlights

- Quick capture inbox for text, URLs, voice transcripts, image notes, and file notes.
- AI harvest engine that extracts summaries, insights, decisions, lessons, risks, opportunities, questions, tags, and categories.
- Knowledge graph for exploring relationships between ideas, projects, decisions, and themes.
- Personal-knowledge-first assistant that retrieves from the user's own graph before using general reasoning.
- Decision memory with expected-vs-actual outcome reviews.
- Weekly intelligence and pattern reports.
- Admin-configurable OpenRouter model settings.
- MongoDB Atlas Vector Search support.

## Stack

| Area | Technology |
| --- | --- |
| Package manager | pnpm |
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| UI | shadcn-style primitives, lucide-react icons |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB / MongoDB Atlas |
| Vector search | MongoDB Atlas Vector Search |
| AI | OpenRouter |
| Auth | JWT email/password, Google ID token login |
| Deployment | Docker Compose, Nginx |

## Repository Structure

```text
.
|-- apps/
|   |-- api/                 Express API and background worker
|   `-- web/                 Next.js dashboard
|-- packages/
|   `-- shared/              Shared TypeScript types and Zod schemas
|-- docs/
|   |-- api.md               API reference
|   `-- deployment.md        Production deployment guide
|-- infra/
|   |-- nginx.conf           Reverse proxy config
|   `-- mongodb-vector-index.json
|-- docker-compose.yml
|-- pnpm-workspace.yaml
`-- .env.example
```

## Prerequisites
- Node.js 20.11 or newer
- pnpm 10.x
- MongoDB Atlas cluster or local MongoDB-compatible instance
- OpenRouter API key for production AI workflows
- Google OAuth client ID if Google login is enabled

## Local Setup

Install dependencies:

```bash
pnpm install
```

Create an environment file:

```bash
cp .env.example .env
```

At minimum, configure:

```bash
MONGODB_URI=...
JWT_ACCESS_SECRET=replace-with-a-long-random-secret
JWT_REFRESH_SECRET=replace-with-a-long-random-secret
```

Recommended for full AI behavior:

```bash
OPENROUTER_API_KEY=...
OPENROUTER_DEFAULT_MODEL=openai/gpt-4.1-mini
EMBEDDING_MODEL=openai/text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
```

Run the app:

```bash
pnpm dev:web
pnpm dev:api
pnpm dev:worker
```

Default local URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:4000/api/v1`
- Health check: `http://localhost:4000/api/v1/health`

If port `3000` is already busy:

```bash
pnpm --dir apps/web exec next dev -p 3001
```

For built production mode on Windows PowerShell:

```powershell
$env:WEB_PORT=3001
pnpm start
```

For built production mode on macOS/Linux:

```bash
WEB_PORT=3001 pnpm start
```

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `APP_URL` | Public web app URL |
| `API_URL` | Public API URL |
| `PORT` | API server port |
| `WEB_PORT` | Web app port for `pnpm start:web` and `pnpm start` |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_ACCESS_SECRET` | Access token signing secret |
| `JWT_REFRESH_SECRET` | Refresh token signing secret |
| `FIRST_ADMIN_EMAIL` | Email to promote to admin on registration |
| `GOOGLE_CLIENT_ID` | Enables Google login |
| `OPENROUTER_API_KEY` | Enables production AI calls |
| `OPENROUTER_DEFAULT_MODEL` | Default reasoning/harvest model |
| `EMBEDDING_MODEL` | Embedding model |
| `EMBEDDING_DIMENSIONS` | Vector dimensions for the embedding model |
| `NEXT_PUBLIC_API_URL` | API URL consumed by the web app |

Without `OPENROUTER_API_KEY`, the backend falls back to deterministic local harvest and embedding behavior. That is useful for development, but production should use OpenRouter.

## Commands

| Command | Description |
| --- | --- |
| `pnpm dev:web` | Start the Next.js app |
| `pnpm dev:api` | Start the Express API |
| `pnpm dev:worker` | Start the background worker |
| `pnpm start` | Start built API and web app |
| `pnpm start:api` | Start built API only |
| `pnpm start:web` | Start built web app only |
| `pnpm start:worker` | Start built worker only |
| `pnpm typecheck` | Typecheck all workspaces |
| `pnpm test` | Run tests |
| `pnpm build` | Build shared package, API, and web app |
| `pnpm lint` | Run workspace lint scripts where available |

Workspace-specific examples:

```bash
pnpm --filter @memora/web build
pnpm --filter @memora/api dev
pnpm --filter @memora/shared typecheck
```

## After `pnpm build`

`pnpm build` only compiles the app. After it finishes, choose how you want to run Memora:

For local production mode:

```bash
pnpm start
pnpm start:worker
```

This starts:

- API on `http://localhost:4000`
- Web app on `http://localhost:3000` by default, or `WEB_PORT` when configured
- Worker as a separate long-running process

If port `3000` is already in use, set `WEB_PORT` before starting:

```powershell
$env:WEB_PORT=3001
pnpm start
```

For development, use the dev commands instead:

```bash
pnpm dev:web
pnpm dev:api
pnpm dev:worker
```

For deployment, prefer Docker Compose:

```bash
docker compose build
docker compose up -d
```

## Core Data Model

The backend defines MongoDB collections for:

- Users
- Settings
- Knowledge Objects
- Relationships
- Decisions
- Reports
- Conversations
- Embeddings
- Jobs

Knowledge Objects include raw content, structured summaries, insights, lessons, decisions, risks, questions, tags, categories, confidence scores, source metadata, relationships, and reference timestamps.

## Main Workflows

### Capture And Harvest

1. User captures content in the Inbox.
2. API creates a pending Knowledge Object.
3. Worker runs AI harvest or deterministic fallback.
4. Worker stores structured fields and queues embedding generation.
5. Worker detects relationships against nearby knowledge.

### Assistant

1. User asks a question.
2. API retrieves relevant personal knowledge with hybrid search.
3. Assistant answers from personal context first.
4. Citations point back to Knowledge Objects.

### Decision Memory

1. User records context, options, reasoning, final choice, and expected outcome.
2. Decision is also captured as knowledge.
3. User later records the actual outcome.
4. AI generates a learning report.

### Reports And Patterns

The worker can generate weekly intelligence reports and pattern reports covering repeated themes, forgotten knowledge, recurring problems, decisions, and recommended areas to explore.

## Vector Search

Production vector search uses MongoDB Atlas Vector Search.

Create the Atlas vector index from:

```text
infra/mongodb-vector-index.json
```

Keep `EMBEDDING_DIMENSIONS` aligned with the index `numDimensions`.

## Deployment

The Docker Compose stack includes:

- `web`: Next.js frontend
- `api`: Express API
- `worker`: background worker
- `nginx`: reverse proxy

Run:

```bash
docker compose build
docker compose up -d
```

MongoDB is expected to be managed separately through MongoDB Atlas.

See:

- `docs/api.md`
- `docs/deployment.md`

## Troubleshooting

### pnpm blocks native build scripts

pnpm requires approval for packages with lifecycle scripts. This repo allows the expected native packages in `pnpm-workspace.yaml`:

- `esbuild`
- `sharp`
- `unrs-resolver`

If install behavior changes, rerun:

```bash
pnpm install
```

### API cannot start

Check:

- `MONGODB_URI` is set.
- MongoDB Atlas network access allows your machine or server.
- JWT secrets are configured.

### AI responses are low quality locally

Set `OPENROUTER_API_KEY`. Without it, the app intentionally uses deterministic fallbacks.

### Web cannot reach API

Check `NEXT_PUBLIC_API_URL`. For local development it should usually be:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

## Security Notes

- Never commit `.env`.
- Use long random JWT secrets in production.
- Restrict MongoDB Atlas network access.
- Rotate OpenRouter and JWT secrets if exposed.
- The first admin is controlled by `FIRST_ADMIN_EMAIL`; configure it before the first production registration.

## Current Scope

Included in this MVP:

- Auth
- Capture
- AI harvest
- Embeddings
- Hybrid search
- Assistant
- Graph view
- Decision memory
- Reports
- Settings
- Docker deployment path

Intentionally out of scope:

- Billing
- S3-compatible binary file storage
- Team workspaces
- Enterprise audit logging
- Advanced permission roles beyond user/admin
