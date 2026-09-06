FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# MissionAccounts has no third-party runtime dependencies. Copy only the
# production server and the scrubbed browser shell; the private Founder preview
# and generated source manifest are deliberately excluded from the image.
COPY --chown=node:node package.json ./package.json
COPY --chown=node:node src ./src
COPY --chown=node:node public/index.production.html ./public/index.production.html
COPY --chown=node:node public/missionaccounts-auth.js ./public/missionaccounts-auth.js
COPY --chown=node:node public/missionaccounts-canonical-adapter.js ./public/missionaccounts-canonical-adapter.js
COPY --chown=node:node public/missionaccounts-runtime.js ./public/missionaccounts-runtime.js
COPY --chown=node:node public/missionaccounts-stripe.js ./public/missionaccounts-stripe.js

USER node
EXPOSE 4179
CMD ["node", "src/server.mjs"]
