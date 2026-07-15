FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY tools/build-app.mjs ./tools/build-app.mjs
COPY web ./web
RUN npm run build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    RISE_ENVIRONMENT=production \
    RISE_WEB_DIRECTORY=/app/dist
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY server.mjs ./server.mjs
COPY src ./src
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 4177
CMD ["node", "server.mjs"]
