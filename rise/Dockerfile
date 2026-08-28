FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY tools/build-app.mjs ./tools/build-app.mjs
COPY web ./web
RUN node tools/build-app.mjs

FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS runtime

ENV NODE_ENV=production \
    RISE_ENVIRONMENT=production \
    RISE_WEB_DIRECTORY=/app/dist
WORKDIR /app
RUN rm -rf /usr/local/lib/node_modules/npm \
    /usr/local/lib/node_modules/corepack \
    /opt/yarn-v${YARN_VERSION} \
    /usr/local/bin/npm \
    /usr/local/bin/npx \
    /usr/local/bin/corepack \
    /usr/local/bin/yarn \
    /usr/local/bin/yarnpkg
COPY server.mjs ./server.mjs
COPY src ./src
COPY adapters ./adapters
COPY tools/prepare-runtime.mjs tools/start-production.mjs ./tools/
COPY --from=build /app/dist ./dist
USER node
EXPOSE 4177
CMD ["node", "tools/start-production.mjs"]
