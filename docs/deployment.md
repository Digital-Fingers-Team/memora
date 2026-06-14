# Production Deployment

Target: Docker VPS with Nginx, API, worker, web, and MongoDB Atlas.

## 1. Prepare MongoDB Atlas

1. Create an Atlas cluster.
2. Create a database user and network access rule for the VPS.
3. Set `MONGODB_URI` in `.env`.
4. Create the vector index from `infra/mongodb-vector-index.json` on the `embeddings` collection.

## 2. Configure Environment

Copy `.env.example` to `.env` and set:

- `APP_URL` to the public site URL.
- `API_URL` to the public API URL.
- `MONGODB_URI` to Atlas.
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` to long random values.
- `FIRST_ADMIN_EMAIL` to the admin email.
- `OPENROUTER_API_KEY` for AI harvest, assistant, reports, and embeddings.
- `GOOGLE_CLIENT_ID` to enable Google login.

## 3. Build And Run

```bash
docker compose build
docker compose up -d
```

Check health:

```bash
curl http://localhost/api/v1/health
```

## 4. TLS

Terminate TLS at Nginx with certificates in `infra/certs`, or put the stack behind a managed reverse proxy such as Cloudflare Tunnel. Update `infra/nginx.conf` with the production `server_name`.

## 5. Operations

- Run one `worker` replica for the MVP. Add replicas when job volume grows.
- Monitor API logs, worker logs, Atlas CPU, vector query latency, and failed jobs.
- Keep `autoIndex` disabled in production; create indexes explicitly during release windows if collection size grows.
- Rotate JWT and OpenRouter secrets through deployment environment variables.
