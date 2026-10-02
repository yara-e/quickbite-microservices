FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm ci

COPY . .

RUN npm run build


# ---------- Stage 2: runtime ----------
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*

# Reproducible install in the runtime image too.
COPY package.json package-lock.json* ./

# Keep ALL deps: the migrate service runs the TypeScript knexfile
# (`knex --knexfile src/lib/knex/knexfile.ts`) via ts-node, a devDep.
# If migrations were precompiled to JS this could be `--omit=dev`.
RUN npm ci

# Compiled JS the server/worker run from.
COPY --from=builder /app/dist ./dist

COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 3000

USER node

ENTRYPOINT ["/usr/bin/tini", "--"]

CMD ["node", "dist/server.js"]
