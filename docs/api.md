# Memora API

Base path: `/api/v1`

All protected endpoints require `Authorization: Bearer <accessToken>`.

## Auth

- `POST /auth/register` creates an email/password user and returns `{ accessToken, refreshToken, user }`.
- `POST /auth/login` returns a session for an existing user.
- `POST /auth/google` validates a Google ID token and upserts a user.
- `POST /auth/refresh` exchanges a refresh token for a new session.
- `POST /auth/logout` is stateless and returns `{ ok: true }`.
- `GET /auth/me` returns the current user.

## Knowledge

- `POST /inbox/capture` creates a pending Knowledge Object and queues harvest processing.
- `GET /knowledge` lists objects. Optional query: `q`, `status`, `tag`, `limit`.
- `POST /knowledge` creates an object directly and queues harvest processing.
- `GET /knowledge/:id` returns and marks an object as referenced.
- `PATCH /knowledge/:id` updates editable object fields and queues embedding refresh.
- `DELETE /knowledge/:id` removes the object and its relationships.
- `POST /knowledge/:id/reprocess` queues AI harvest again.

## AI, Search, Assistant

- `POST /ai/harvest/:knowledgeObjectId` runs harvest immediately.
- `POST /search/semantic` body: `{ "query": "...", "limit": 10 }`.
- `POST /search/hybrid` combines Atlas Vector Search/fallback cosine search with text search.
- `POST /assistant/chat` retrieves personal knowledge first, then answers with citations.
- `GET /assistant/conversations`
- `GET /assistant/conversations/:id`

## Graph, Decisions, Reports

- `GET /graph`
- `GET /graph/object/:id`
- `POST /relationships`
- `PATCH /relationships/:id`
- `DELETE /relationships/:id`
- `GET /decisions`
- `POST /decisions`
- `GET /decisions/:id`
- `PATCH /decisions/:id`
- `POST /decisions/:id/review`
- `GET /reports`
- `GET /reports/:id`
- `POST /reports/generate-weekly`
- `GET /patterns`
- `POST /patterns/analyze`

## Settings

- `GET /settings`
- `PATCH /settings`
- `GET /admin/settings`
- `PATCH /admin/settings`

The first registered user becomes admin, unless `FIRST_ADMIN_EMAIL` is set, in which case that email becomes the seeded admin on registration.
