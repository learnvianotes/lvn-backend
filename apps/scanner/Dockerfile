# The upload scanner (ADR-0102). It has no database client and no object-storage credentials.
# Build from the repository root. No BuildKit cache mount: the scanner host's docker build must work as-is.
#   docker build -f apps/scanner/Dockerfile -t lvn-scanner .

ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${NODE_IMAGE} AS build
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @lvn-backend/scanner-protocol build && pnpm --filter @lvn-backend/scanner build
# The runtime image is the scanner and the protocol package. PDF checks stream the file; they do not
# load it with pdf-lib. A workspace deploy also pulled Prisma, so this stage copies only what the process imports.
RUN mkdir -p /out/node_modules/@lvn-backend/scanner-protocol \
 && cp -a apps/scanner/dist /out/dist \
 && printf '%s\n' '{"name":"@lvn-backend/scanner","private":true}' > /out/package.json \
 && cp -a /repo/libs/scanner-protocol/dist /out/node_modules/@lvn-backend/scanner-protocol/dist \
 && cp /repo/libs/scanner-protocol/package.json /out/node_modules/@lvn-backend/scanner-protocol/package.json

FROM ${NODE_IMAGE}
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates tini && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production HOME=/tmp TMPDIR=/tmp
WORKDIR /app
COPY --from=build --chown=node:node /out /app
USER node
EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]
