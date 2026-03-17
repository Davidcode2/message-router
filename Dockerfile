FROM node:22-alpine AS base

WORKDIR /app

FROM base AS dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

FROM base AS production
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY src/ ./src/
COPY config/ ./config/

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/healthz', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

CMD ["node", "src/server.js"]
