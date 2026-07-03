# Build stage – use Node.js 20 (LTS)
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev, e.g., Vite).
# The self-hosted runner occasionally has slow/flaky connectivity to
# registry.npmjs.org, which kills `npm ci` with EIDLETIMEOUT once it hits the
# default 5-min fetch-timeout. Give npm more patience and more retries so a
# transient network hiccup doesn't fail the whole build.
RUN npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-timeout 600000 \
    && npm ci \
    && npm cache clean --force

# Copy source code
COPY . .

# Allow overriding API base URL at build time
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# The origin this build is served from — baked into index.html's Open Graph / Twitter
# tags (see vite.config.js). Per-environment (dev vs prod); falls back to the prod
# origin when unset so social embeds still resolve.
ARG VITE_SITE_URL
ENV VITE_SITE_URL=$VITE_SITE_URL

# Deployment-specific copy baked in at build time (see src/hooks.js). Fall back to
# the client's own defaults when unset, so a plain build still works.
ARG VITE_HOSTED_IN
ENV VITE_HOSTED_IN=$VITE_HOSTED_IN
ARG VITE_DMCA_MAIL
ENV VITE_DMCA_MAIL=$VITE_DMCA_MAIL

# Build the Vite application
RUN npm run build

# Helper build stage – cross-compile the Discord Rich Presence bridge
# (rpc-helper/) for every platform. These are served as static downloads from
# the site itself (see the /helper location in nginx.conf), because the repo is
# private so GitHub Release assets aren't publicly downloadable.
FROM golang:1.26-alpine AS helper

WORKDIR /helper

# Resolve modules first for layer caching.
COPY rpc-helper/go.mod rpc-helper/go.sum ./
RUN go mod download

COPY rpc-helper/ ./

# CGO stays off so these stay statically linked and cross-compile cleanly. The
# Windows builds get -H=windowsgui so they run as a tray app with no console
# window; the 4th build() arg carries those per-OS extra linker flags.
ENV CGO_ENABLED=0
RUN set -eu; \
    mkdir -p /out; \
    build() { GOOS="$1" GOARCH="$2" go build -trimpath -ldflags "-s -w ${4:-}" -o "/out/$3" .; }; \
    build windows amd64 crimson-presence-helper-windows-amd64.exe "-H=windowsgui"; \
    build windows arm64 crimson-presence-helper-windows-arm64.exe "-H=windowsgui"; \
    build darwin  amd64 crimson-presence-helper-macos-amd64; \
    build darwin  arm64 crimson-presence-helper-macos-arm64; \
    build linux   amd64 crimson-presence-helper-linux-amd64; \
    build linux   arm64 crimson-presence-helper-linux-arm64

# Production stage with Nginx
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy the cross-compiled presence helpers so they're downloadable at /helper/.
COPY --from=helper /out /usr/share/nginx/html/helper

# Copy custom Nginx config for SPA routing (+ shared security-headers snippet)
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf

EXPOSE 80

# Container-level health probe (used by Docker Swarm for self-healing). Hits the
# lightweight /healthz endpoint served by nginx.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q --spider http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]