# ============================================
# Stage 1: Build
# ============================================
FROM node:22-slim AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first (better layer caching)
COPY package.json package-lock.json* ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy Prisma schema
COPY models/prisma ./models/prisma

# Generate Prisma client (schema is at models/prisma/schema.prisma)
RUN npx prisma generate --schema=models/prisma/schema.prisma

# Copy source code
COPY tsconfig.json ./
COPY app ./app
COPY api ./api

# Compile TypeScript
RUN npm run build \
    && ls dist/ 2>/dev/null || (echo "❌ build failed: dist/ not found" && exit 1)

# ============================================
# Stage 2: Production
# ============================================
FROM node:22-slim AS production

WORKDIR /app

# Install build dependencies (needed for prisma migrate)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy Prisma schema and generated client
COPY models/prisma ./models/prisma
RUN npx prisma generate --schema=models/prisma/schema.prisma

# Copy compiled output
COPY dist ./dist

# Copy start script
COPY start.sh ./
RUN chmod +x start.sh

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "const http = require('http'); http.get('http://localhost:5000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start
CMD ["./start.sh"]
