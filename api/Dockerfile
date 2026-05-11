FROM node:24-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src

RUN npx prisma generate && npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate

COPY --from=builder /app/dist ./dist
COPY src/app/Views/emails ./src/app/Views/emails

COPY docker/entrypoint.prod.sh /entrypoint.prod.sh
RUN chmod +x /entrypoint.prod.sh

EXPOSE 3333
ENTRYPOINT ["/entrypoint.prod.sh"]
CMD ["node", "dist/server.js"]
