# Knowledge Harvest

Knowledge Harvest is an AI-powered Thinking OS for capturing, structuring, connecting, and reusing personal knowledge.

This repository is a production MVP monorepo:

- `apps/web`: Next.js dashboard
- `apps/api`: Express API and background worker
- `packages/shared`: shared TypeScript types and Zod schemas

See `docs/deployment.md` for production deployment and `docs/api.md` for API details.

## Development

Use pnpm:

```bash
pnpm install
pnpm dev:web
pnpm dev:api
pnpm dev:worker
```
