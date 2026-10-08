# syntax=docker/dockerfile:1.7
# The backend image (spec §16.2): built once per commit and promoted sandbox → production. One image, three uses:
#   docker run <image>                                                 GraphQL API on :4000 (default)
#   docker run <image> node apps/worker/dist/main.js                   background jobs
#   docker run <image> node node_modules/prisma/build/index.js migrate deploy    migrations, before new api tasks start
# Configuration comes only from the environment (docs/architecture/env.md); no .env file is copied in.
#   docker build -f infra/docker/api.Dockerfile -t lvn-backend .

ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS build
# Prisma's schema engine needs OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@lvn-backend/api... --filter=@lvn-backend/worker...
# Production dependencies only; the built dist/ folders stay.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store rm -rf node_modules */*/node_modules contracts/node_modules \
  && pnpm install --frozen-lockfile --prod \
  && find . -path ./node_modules -prune -o \( -name '*.ts' ! -name '*.d.ts' ! -name 'prisma.config.ts' \) -type f -print | xargs rm -f

FROM ${NODE_IMAGE}
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tini && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
# Amazon RDS certificate authorities: Node does not trust them by default, and DATABASE_URL verifies the server
# (sslmode=verify-full). Readable by the unprivileged user.
ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /etc/ssl/certs/rds-global-bundle.pem
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/rds-global-bundle.pem
WORKDIR /app
COPY --from=build --chown=node:node /repo /app
USER node
EXPOSE 4000 4001
# tini forwards SIGTERM to node, which closes the app and flushes telemetry before exiting (stopOnSignals).
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "apps/api/dist/main.js"]
