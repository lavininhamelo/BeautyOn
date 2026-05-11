# BeautyOn

API de agendamentos (Express, TypeScript, Prisma, **MySQL**). Fila de jobs (ex.: email de cancelamento) persistida na própria base (`jobs`), no mesmo processo Node — sem Redis.

## Requisitos

- **Node.js** 20+
- **npm** 9+
- **MySQL** 8.0+ (recomendado; a fila usa `FOR UPDATE SKIP LOCKED`)

## Instalação local

```bash
npm install
```

Cria um ficheiro `.env` (copia de [`.env.example`](./.env.example)) e define `DATABASE_URL`, `APP_SECRET` e (opcional) `MAIL_*`.

```bash
DATABASE_URL="mysql://USER:PASSWORD@127.0.0.1:3306/beautyon"
APP_SECRET="uma-chave-segura"
APP_URL="http://localhost:3333"
PORT=3333
```

Aplica o schema na base:

```bash
npx prisma migrate dev
```

Gera o client do Prisma (o script `build` também corre isto):

```bash
npx prisma generate
```

### Correr em desenvolvimento

```bash
npm run dev
```

A API fica em `http://localhost:3333` (ou na porta definida em `PORT`).

### Rotas úteis (com `Authorization: Bearer <token>`)

| Método e URL | Descrição |
|-------------|-----------|
| `GET /profile` | Dados do utilizador (incl. `avatar` com `url`) |
| `POST /users/avatar` | `multipart/form-data` com ficheiro no campo **`avatar`**; grava avatar e devolve `{ id, name, path, url }` |
| `GET /appointments/me` | Igual a `/appointments` quando não há query; com **`?year=2026&month=4&day=9`** (mês 1–12): agendamentos **desse dia** |

### Outros scripts úteis

| Comando | Descrição |
|--------|-----------|
| `npm run build` | Gera o Prisma client e compila o TypeScript para `dist/` |
| `npm start` | Inicia a app já compilada (`node dist/server.js`) |
| `npm run typecheck` | TypeScript em modo verificação (`tsc --noEmit`) |
| `npx prisma migrate dev` | Cria/aplica migrações em dev (interativo) |
| `npx prisma migrate deploy` | Aplica migrações pendentes (produção/CI) |
| `npx prisma db push` | Sincroniza o schema com a DB **sem** criar ficheiro de migração (só em dev) |
| `npm run set-provider -- user@example.com` | Marca utilizador como prestador (`provider: true`) |

## Variáveis de ambiente (resumo)

| Variável | Uso |
|----------|-----|
| `DATABASE_URL` | URL do MySQL (obrigatória para o Prisma) |
| `APP_SECRET` | Chave do JWT (login) |
| `APP_URL` | Base URL pública (links de ficheiros no e-mail / API) |
| `PORT` | Porta HTTP (padrão: `3333`) |
| `CORS_ORIGIN` | Origens CORS, separadas por vírgula; se vazio, aceita o front em `http://localhost:3000` e `http://127.0.0.1:3000`; `*` = qualquer origem (evitar em prod) |
| `QUEUE_POLL_INTERVAL_MS` | Intervalo do worker da fila em ms (padrão: `2000`) |
| `QUEUE_MAX_ATTEMPTS` | Tentativas por job antes de `failed` (padrão: `5`) |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS` | Envio de e-mail (Nodemailer) |

## Docker (desenvolvimento)

Na pasta `api/` existe `docker-compose.yml` com **MySQL 8.4**, **Mailhog** e o serviço **`app`** (`Dockerfile.dev`).

### Só infra (MySQL + Mailhog) — API a correr no teu terminal

```bash
cd api && npm run docker:infra
```

No `.env` local (Node **fora** do Docker) usa `127.0.0.1` / `localhost`:

- `DATABASE_URL="mysql://root:root@127.0.0.1:3306/beautyon"`
- `MAIL_HOST=127.0.0.1`, `MAIL_PORT=1025`

Depois: `npm run dev` na pasta `api/`.

### Tudo no Compose (API dentro do contentor)

```bash
cd api && docker compose up -d --build
```

Migrações na primeira vez (com os serviços a correr):

```bash
docker compose run --rm app npx prisma migrate deploy
```

Atalhos: `npm run docker:up`, `npm run docker:logs:app`. UI do Mailhog: `http://localhost:8025`.

### Imagem de produção

```bash
cd api && docker build -f Dockerfile -t beautyon-api:prod .
```

O `entrypoint` de produção corre `prisma migrate deploy` antes de `node dist/server.js` (define `SKIP_MIGRATIONS=1` para saltar).

## Estrutura do repositório (notas)

- `prisma/` — `schema.prisma` e `migrations/`
- `src/` — código TypeScript
- `dist/` — saída do `tsc` (gerada pelo build)

## Licença

MIT (ver `package.json`).
