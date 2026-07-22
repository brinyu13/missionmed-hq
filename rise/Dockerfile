FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY tools/build-app.mjs ./tools/build-app.mjs
COPY web ./web
RUN npm run build

FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS runtime

ENV NODE_ENV=production \
    RISE_ENVIRONMENT=production \
    RISE_WEB_DIRECTORY=/app/dist \
    RISE_AUTH_ADAPTER_MODULE=/app/adapters/hq-auth.mjs \
    RISE_ABUSE_ADAPTER_MODULE=/app/adapters/http-abuse.mjs
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY server.mjs ./server.mjs
COPY src ./src
COPY adapters ./adapters
COPY tools/prepare-runtime.mjs tools/start-production.mjs ./tools/
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 4177
CMD ["node", "tools/start-production.mjs"]
