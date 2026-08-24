FROM node:22-bookworm-slim AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY index.html tsconfig.json tsconfig.server.json vite.config.ts ./
COPY src ./src
COPY server ./server
RUN pnpm build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001 \
    DATABASE_PATH=/app/server/data/app.db

RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile && pnpm store prune

COPY --from=build /app/dist ./dist
COPY --from=build /app/server-dist ./server-dist

RUN mkdir -p /app/server/data && chown -R node:node /app

USER node
EXPOSE 3001

CMD ["node", "server-dist/index.js"]
