FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY --chown=node:node dist ./dist
COPY --chown=node:node server-dist ./server-dist
COPY --chown=node:node server/data ./server/data
RUN mkdir -p /app/tmp/config-uploads && chown node:node /app/tmp/config-uploads

ENV HOST=0.0.0.0 \
    PORT=3001 \
    NODE_ENV=production \
    DATABASE_PATH=/app/server/data/app.db \
    UPLOAD_TMP_DIR=/app/tmp/config-uploads

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

USER node

CMD ["node", "server-dist/index.js"]
