# BeautyOn API

Scheduling API (Express, TypeScript, Prisma, **MySQL**). Job queue (e.g. cancellation email) persisted in the same database (`jobs`), in the same Node process — no Redis.

## Requirements

- **Node.js** 20+
- **npm** 9+
- **MySQL** 8.0+ (recommended; the queue uses `FOR UPDATE SKIP LOCKED`)

## Local setup

```bash
npm install
```

Create a `.env` file (copy from [`.env.example`](./.env.example)) and set `DATABASE_URL`, `APP_SECRET`, and optionally `MAIL_*`.

```bash
DATABASE_URL="mysql://USER:PASSWORD@127.0.0.1:3306/beautyon"
APP_SECRET="a-secure-random-string"
APP_URL="http://localhost:3000"
PORT=3000
```

Apply the schema to the database:

```bash
npx prisma migrate dev
```

Generate the Prisma client (the `build` script also runs this):

```bash
npx prisma generate
```

### Development server

```bash
npm run dev
```

The API listens at `http://localhost:3000` (or the port in `PORT`).

### Useful routes (with `Authorization: Bearer <token>`)

| Method & URL | Description |
|--------------|-------------|
| `GET /profile` | Current user (includes `avatar` with `url`) |
| `POST /users/avatar` | `multipart/form-data` with file field **`avatar`**; saves avatar, returns `{ id, name, path, url }` |
| `GET /appointments/me` | Same as `/appointments` without query; with **`?year=2026&month=4&day=9`** (month 1–12): appointments **for that day** |

### Other useful scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Prisma generate + compile TypeScript to `dist/` |
| `npm start` | Run compiled app (`node dist/server.js`) |
| `npm run typecheck` | TypeScript check only (`tsc --noEmit`) |
| `npx prisma migrate dev` | Create/apply migrations in dev (interactive) |
| `npx prisma migrate deploy` | Apply pending migrations (production/CI) |
| `npx prisma db push` | Sync schema to DB **without** a migration file (dev only) |
| `npm run set-provider -- user@example.com` | Mark user as provider (`provider: true`) |

## Environment variables (summary)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | MySQL URL (required for Prisma) |
| `APP_SECRET` | JWT signing secret (login) |
| `APP_URL` | Public base URL (file links in email / API) |
| `PORT` | HTTP port (default `3000`) |
| `CORS_ORIGIN` | Comma-separated CORS origins; if empty, allows `http://localhost:3000` and `http://127.0.0.1:3000`; `*` = any origin (avoid in production) |
| `QUEUE_POLL_INTERVAL_MS` | Queue worker poll interval in ms (default `2000`) |
| `QUEUE_MAX_ATTEMPTS` | Retries per job before `failed` (default `5`) |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS` | Outbound email (Nodemailer) |

## Docker (development)

`api/docker-compose.yml` includes **MySQL 8.4**, **Mailhog**, and the **`app`** service (`Dockerfile.dev`).

### Infra only (MySQL + Mailhog) — API on your host

```bash
cd api && npm run docker:infra
```

In local `.env` (Node **outside** Docker) use `127.0.0.1` / `localhost`:

- `DATABASE_URL="mysql://root:root@127.0.0.1:3306/beautyon"`
- `MAIL_HOST=127.0.0.1`, `MAIL_PORT=1025`

Then run `npm run dev` in `api/`.

### Full stack in Compose (API in container)

```bash
cd api && docker compose up -d --build
```

First-time migrations (with services up):

```bash
docker compose run --rm app npx prisma migrate deploy
```

Shortcuts: `npm run docker:up`, `npm run docker:logs:app`. Mailhog UI: `http://localhost:8025`.

### Production image

```bash
cd api && docker build -f Dockerfile -t beautyon-api:prod .
```

The production entrypoint runs `prisma migrate deploy` before `node dist/server.js` (set `SKIP_MIGRATIONS=1` to skip).

## Repository layout (notes)

- `prisma/` — `schema.prisma` and `migrations/`
- `src/` — TypeScript source
- `dist/` — `tsc` output (from build)

## License

MIT (see `package.json`).
