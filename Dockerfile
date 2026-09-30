FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

# The runner's link to registry.npmjs.org is flaky enough that the default
# 5 minute fetch timeout kills `npm ci` with EIDLETIMEOUT.
RUN npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-timeout 600000 \
    && npm ci \
    && npm cache clean --force

COPY . .

# Vite bakes these in at build time; see the README for what each controls.
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ARG VITE_SITE_URL
ENV VITE_SITE_URL=$VITE_SITE_URL
ARG VITE_HOSTED_IN
ENV VITE_HOSTED_IN=$VITE_HOSTED_IN
ARG VITE_DMCA_MAIL
ENV VITE_DMCA_MAIL=$VITE_DMCA_MAIL

RUN npm run build

# The Discord presence helper is served from the site itself (/helper/) because
# the repository is private, so release assets are not publicly downloadable.
FROM golang:1.26-alpine AS helper

WORKDIR /helper

COPY rpc-helper/go.mod rpc-helper/go.sum ./
RUN go mod download

COPY rpc-helper/ ./

# -H=windowsgui makes the Windows builds a tray app with no console window.
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

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=helper /out /usr/share/nginx/html/helper
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q --spider http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
