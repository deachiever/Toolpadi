# Multi-stage production Dockerfile for ToolPadi
# Compatible with Google Cloud Run, Linux VPS (Docker Compose), and containerized PaaS

# --- STAGE 1: Build Frontend and Compile Assets ---
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy application source code
COPY . .

# Build Vite frontend bundle
RUN npm run build

# --- STAGE 2: Lightweight Production Runtime ---
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built frontend assets from builder
COPY --from=builder /app/dist ./dist

# Copy backend server code, migrations, and assets
COPY --from=builder /app/server ./server
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/scripts ./scripts

# Create directories for persistent uploads and logs
RUN mkdir -p /app/uploads /app/data && chown -R node:node /app

# Security: Run as non-privileged user
USER node

# Expose standard application port
EXPOSE 3000

# Container healthcheck for Cloud Run / Docker Compose / Kubernetes
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start full-stack Node.js server
CMD ["npx", "tsx", "server.ts"]
