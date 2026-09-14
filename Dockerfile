FROM node:22-slim

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

# Generate Prisma client
RUN npx prisma generate --schema=models/prisma/schema.prisma

# Copy source code
COPY tsconfig.json ./
COPY app ./app
COPY api ./api

# Compile TypeScript
RUN npm run build

# Verify dist/ was created
RUN ls -la dist/ || { echo "FATAL: dist/ not found after build"; exit 1; }

# Remove dev dependencies after build
RUN npm prune --omit=dev

# Copy start script
COPY start.sh ./
RUN chmod +x start.sh

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "const http = require('http'); http.get('http://localhost:5000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["./start.sh"]
