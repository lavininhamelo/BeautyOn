# BeautyOn

Monorepo with a single-deploy bundle:

- [`api/`](./api) — Express + TypeScript + Prisma (MySQL)
- [`web/`](./web) — React SPA (CRA + Craco)

In production, the API serves the SPA as static files. One Node process, one origin, one deploy.

## Layout in production

```
/api  -> /api/* (Express routes)
/files -> uploaded user content (static)
/      -> SPA (index.html + assets); unknown routes also fall back to index.html
```

The SPA build is copied into [`api/dist/public`](./api/dist/public) by the root build script. The API picks it up automatically via [`webBuildDir`](./api/src/lib/paths.ts).

## Local development

Two terminals:

```bash
# Terminal 1 (API)
cd api && npm install && npm run dev

# Terminal 2 (SPA)
cd web && npm install && npm run start
```

In dev the SPA runs on `:8080` and the API on `:3000`. The SPA reads `REACT_APP_API_URL=http://localhost:3000/api` from [`web/.env`](./web/.env). In production both share `:3000` (SPA on `/`, API on `/api`).

For all API details (Docker dev infra, MySQL, queue, etc.) see [`api/README.md`](./api/README.md).

## Production build (single bundle)

From the repository root:

```bash
npm run build
```

This installs both packages, builds the SPA, builds the API, and copies the SPA into [`api/dist/public`](./api/dist/public).

To run:

```bash
npm start
```

Which runs `prisma migrate deploy` and then `node api/dist/server.js`.

## Production environment variables

There are **two** sets of env vars in production:

### 1. API (read at runtime, server-side)

Use [`.env.production.example`](./.env.production.example) as the template. Two ways to provide them:

- **Recommended (Hostinger)**: set each key in **hPanel → Node.js Apps → Environment Variables**. The values present in `process.env` always win over any `.env` file.
- **File-based**: copy `.env.production.example` to `.env.production` at the project root. `server.js` loads it on boot (it also accepts `.env` or `api/.env` as fallbacks). The file is gitignored.

### 2. SPA (read at build time, baked into the JS bundle)

[`web/.env.production`](./web/.env.production) is committed with `REACT_APP_API_URL=` (empty), so the SPA falls back to `/api` on the same origin. **Do not** set it to a localhost URL in production — leave it empty for single-deploy. If you ever host the SPA on a different domain, set it to `https://api.yourdomain.com/api` instead.

## Deploy on Hostinger Node.js Apps

Reference: [Hostinger Node.js apps guide](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/).

You have two options:

### Pre-built bundle (recommended)

Build locally, upload only the runtime files. No SPA toolchain needed on the server.

```bash
npm run build       # builds web + api, copies SPA into api/dist/public, copies hbs templates
npm run pack:zip    # produces ./beautyon-deploy.zip
```

The zip contains a flat structure:

```
server.js           # entry: loads env, runs prisma migrate deploy, boots Express
package.json        # all API prod deps inlined; postinstall = prisma generate
api/dist/           # compiled API + SPA build at api/dist/public/
api/prisma/         # schema + migrations
```

In hPanel:

1. **Add Website → Node.js Apps → Framework: Other**.
2. Upload the zip and extract into the application root.
3. **Environment Variables** — set everything from [`.env.production.example`](./.env.production.example). Minimum: `NODE_ENV=production`, `APP_SECRET`, `APP_URL`, `DATABASE_URL`, `MAIL_*`.
4. **Application startup file**: `server.js`.
5. Click **Run NPM Install** — installs deps to `node_modules/` and triggers `postinstall` (`prisma generate` with the **Linux** binaries).
6. Click **Start application**.

> Do not upload `node_modules/` from your machine — Prisma has platform-specific binaries (macOS arm64 ≠ Hostinger Linux x64). The server-side `npm install` handles it.

### Test the bundle locally

```bash
npm run build && npm run pack
cd deploy
npm install         # installs deps + prisma generate
node server.js      # loads .env, runs migrations, boots on $PORT (default 3000)
```

### After first deploy

- Visit `https://<your-domain>/api/health` → should return `{ "status": "ok" }`.
- Visit `https://<your-domain>/` → SPA loads.
- Promote a user to provider: SSH into the app and run `npm --prefix api run set-provider -- you@example.com`.

### 503 Service Unavailable (LiteSpeed)

If logs show the boot banner stopping right after `importing api/dist/server.js` and never show `BeautyOn API ready`, the reverse proxy cannot reach your Node process. Common fixes:

1. **Bind address**: the app listens on `0.0.0.0` and the port from `PORT` (Hostinger sets this). If your panel still returns 503, add env **`LISTEN_HOST=127.0.0.1`** and restart (some stacks expect localhost only).
2. **Startup file**: must be exactly `server.js` in the Node app root (same folder as `package.json` from the zip).
3. **Build command**: keep `npm run build` so migrations run outside the LVE-limited runtime process.

### Notes

- File uploads land in `api/tmp/uploads/` inside the deploy. On Hostinger shared/cloud hosting this persists across restarts; verify if you need a longer-term solution (e.g., object storage) before relying on it for production photos.
- The job queue (cancellation emails) runs inside the same Node process, polling MySQL — no Redis needed.
- CORS is enabled but irrelevant in single-bundle mode (SPA and API share the origin).
