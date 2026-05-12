# CMD AI Adoption Exam 2026 — Event Registration

Monorepo deployed as a single Vercel project:

- `apps/web` — Next.js 15 frontend + the `/api/[...path]` catch-all route that boots `apps/api` (Nest.js 10) inside the same serverless function via `@vendia/serverless-express`.
- `apps/api` — Nest.js 10 backend. Runs in-process inside the Next function on Vercel; runs standalone for local dev.
- Persistence: **Vercel Postgres** (registrations + documents metadata) + **Vercel Blob** (uploaded documents).
- Name-tag PDF: `pdf-lib` + IBM Plex Sans Thai (embedded) + QR code linking to `<PUBLIC_URL>/admin/<id>`.

## Deploy to Vercel

1. **Push the repo to GitHub.**
2. In the Vercel dashboard, **Import Project** → pick this repo.
   - Root directory: `apps/web` (auto-detected via `vercel.json`).
   - Build & install commands: pre-set in `vercel.json`.
3. **Add a Postgres store**: Project → Storage → Create → Postgres. Vercel will inject `POSTGRES_URL` into the project env automatically.
4. **Add a Blob store**: Project → Storage → Create → Blob. Vercel injects `BLOB_READ_WRITE_TOKEN`.
5. **Set the remaining environment variables** under Project → Settings → Environment Variables (Production scope):
   - `ADMIN_USERNAME` — staff login
   - `ADMIN_PASSWORD` — staff login (use something strong)
   - `JWT_SECRET` — `openssl rand -hex 32`
   - `EVENT_NAME` — e.g. `CMD Exam '26`
   - `PUBLIC_URL` — your deployment URL, e.g. `https://your-app.vercel.app`
6. **Deploy.** The first invocation creates the Postgres schema automatically.
7. **Smoke test** the deployed URL:
   - `/register` → submit a registration
   - `/lookup` → enter the reference code + password
   - `/admin/login` → sign in
   - Open a registration, click *Download name tag (PDF)*

## Local development

Local dev works without Vercel — you can run the apps standalone against a local Postgres.

```bash
pnpm install

# 1. Start a local Postgres (Docker shortcut)
docker run -d --name cmd-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=cmd postgres:16

# 2. Configure the API
cp apps/api/.env.example apps/api/.env
# Edit POSTGRES_URL=postgres://postgres:postgres@localhost:5432/cmd
# (Leave BLOB_READ_WRITE_TOKEN blank — the StorageService falls back to data: URLs.)

# 3. Run both apps
pnpm dev   # api on :8080, web on :3000
```

The web's `/api/[...path]` proxy will boot a Nest app inside Next. Open http://localhost:3000.

> **Note**: leaving `BLOB_READ_WRITE_TOKEN` blank stores uploaded files as base64 data URLs inline in Postgres. Fine for a local demo, but every file inflates one row — don't use it for real traffic. Set up Vercel Blob (free 1 GB) for proper storage.

## Tests

```bash
pnpm test:api
```

API tests run against `pg-mem` (in-memory Postgres). No external services required.

## Configuration limits

- **Max upload size per file**: 4 MB (Vercel Hobby request-body cap is 4.5 MB).
- **Allowed mime types**: `application/pdf`, `image/png`, `image/jpeg`, `application/msword`, `.docx`.
- **Reference code format**: `REG-XXXXXX` (Crockford base32, 6 chars). Collision-checked on insert with 5 retries.
- **JWT TTL**: 2 hours (`JWT_TTL`).

## Project layout

```
.
├── vercel.json                      # Vercel root config
├── apps/
│   ├── web/                         # Next.js — deploys to Vercel
│   │   ├── next.config.ts           # transpilePackages: ['api'], Nest externals
│   │   ├── .swcrc                   # decorators + decoratorMetadata for Nest
│   │   └── src/app/api/[...path]/   # Catch-all route boots Nest
│   └── api/                         # Nest.js — imported by Web on Vercel
│       ├── src/serverless.ts        # getExpressApp() — Nest mounted in Express
│       ├── src/main.ts              # Standalone entry for local dev
│       ├── src/storage/             # Postgres + Vercel Blob adapter
│       ├── src/pdf/nametag.ts       # PDF badge generator
│       └── assets/fonts/            # IBM Plex Sans Thai / Serif / Mono TTFs
```

## Risks / caveats

- **Cold starts**: ~1–2s on the first request after idle. Nest bootstrapping inside the function is the main cost. Warm requests are fast.
- **Single function, single Nest instance**: all `/api/*` traffic goes through one warm function. Fine for an event; not horizontally scalable inside one function.
- **Blob URLs are public-but-unguessable**: `@vercel/blob` doesn't have private files on the Hobby plan. Document URLs include random suffixes, but anyone who has the URL can fetch. Server-side, we proxy downloads through the admin/user JWT-gated endpoint, so the URL never leaks to the browser.
- **Password reset is out of scope.** Lost-password = lost registration. Admin can still see the row and reach the user via email.
- **Postgres free tier on Vercel** is 256 MB. Plenty for a small event; not for storing files there.
