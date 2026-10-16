# Multi-stage production build for Untitled Judge (SvelteKit + Bun)
FROM oven/bun:1.4-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy application files and schema
COPY . .

# Generate Prisma client
RUN bun x prisma generate

# Build SvelteKit application for standalone Node/Bun server
ENV ADAPTER=node
ENV NODE_ENV=production
RUN bun run build

# ==========================================
# Runner Image
# ==========================================
FROM oven/bun:1.4-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Install pdftotext (poppler-utils) for statement text processing
RUN apk add --no-cache poppler-utils

# Copy built application and required production files
COPY package.json bun.lock* ./
COPY prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/storage ./storage

EXPOSE 3000

# Start production server
CMD ["bun", "build/index.js"]

