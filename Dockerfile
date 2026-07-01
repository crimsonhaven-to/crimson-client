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

# Extension-pack stage – zip the companion extension (vendor/crimson-extension,
# a private git submodule) so it's downloadable straight from the site. Same
# rationale as the rpc-helper above: the repo is private, so GitHub Release
# assets aren't publicly fetchable. The viewer downloads the zip, unpacks it and
# side-loads it (Load unpacked) — see the /extension Download page in the client.
FROM alpine:3.20 AS extpack

WORKDIR /work

RUN apk add --no-cache zip

# The companion extension is a PRIVATE submodule (vendor/crimson-extension) and may
# be ABSENT when building without access to it (a fork / no SUBMODULES_TOKEN). Copy
# the whole vendor tree (always present, possibly with an empty extension dir) and
# guard on the manifest so the image still builds — the /extension download is just
# unavailable in that case, rather than failing the whole build.
COPY vendor ./vendor

# Drop any VCS metadata, then zip the folder itself so unpacking yields a single
# `crimson-extension/` directory with manifest.json at its root (exactly what
# "Load unpacked" expects). manifest.json is copied out alongside so the Download
# page can show the live version without hardcoding it.
RUN mkdir -p /out; \
    if [ -f vendor/crimson-extension/manifest.json ]; then \
      cp -r vendor/crimson-extension ./crimson-extension; \
      rm -rf crimson-extension/.git; \
      zip -r -X /out/crimson-extension.zip crimson-extension; \
      cp crimson-extension/manifest.json /out/manifest.json; \
      echo "✓ companion extension packed"; \
    else \
      echo "ℹ no companion extension bundled — /extension download will be unavailable"; \
    fi

# Production stage with Nginx
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy the cross-compiled presence helpers so they're downloadable at /helper/.
COPY --from=helper /out /usr/share/nginx/html/helper

# Copy the packed companion extension so it's downloadable at /extension/.
COPY --from=extpack /out /usr/share/nginx/html/extension

# Copy custom Nginx config for SPA routing (+ shared security-headers snippet)
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf

EXPOSE 80

# Container-level health probe (used by Docker Swarm for self-healing). Hits the
# lightweight /healthz endpoint served by nginx.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q --spider http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]