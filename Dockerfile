# SpecPad server — the self-hosted delivery model.
#
# One image serving the version-pinned editor build and its API from a single origin.
# The runtime entry point is exactly the command `npm run server` runs, so the container
# and a local checkout start the server the same way.
#
# Build:  docker build -t specpad-server .
# Run:    docker run -p 8080:8080 \
#           -v /srv/specpad:/srv/specpad \
#           -v ./specpad-server.config.json:/etc/specpad/config.json:ro \
#           -v ~/.ssh/deploy-key:/run/secrets/specpad-deploy-key:ro \
#           specpad-server

# ---- Build the editor ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Runtime ----
FROM node:22-alpine
# git is the storage engine; openssh-client is needed for an ssh:// remote.
RUN apk add --no-cache git openssh-client
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
# Production dependencies give us ajv (the contract's validator); tsx runs the
# TypeScript entry point directly, the same way the verified `npm run server` does.
RUN npm ci --omit=dev && npm install --no-save tsx@^4.22.4 && npm cache clean --force

# Only what the server actually imports: itself, the shared contract, and the
# transport types. The editor's React sources are not part of the runtime.
COPY server ./server
COPY src/shared ./src/shared
COPY src/transports ./src/transports
COPY tsconfig.json ./
COPY --from=build /app/dist ./dist

ENV SPECPAD_EDITOR_DIR=/app/dist

# The working directory holds the bare clone and per-user worktrees, so it must be
# writable by the runtime user and should be a volume that outlives the container.
RUN mkdir -p /srv/specpad && chown -R node:node /srv/specpad
VOLUME ["/srv/specpad"]
USER node

EXPOSE 8080
ENTRYPOINT ["npx", "tsx", "server/index.ts"]
CMD ["/etc/specpad/config.json"]
