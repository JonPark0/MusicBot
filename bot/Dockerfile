FROM node:22-alpine

# Install required dependencies for voice and audio processing
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    ffmpeg \
    opus-dev \
    pixman-dev \
    cairo-dev \
    pango-dev \
    libc-dev \
    ca-certificates \
    curl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev for TypeScript compilation)
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Set environment
ENV NODE_ENV=production

# Start the bot
CMD ["node", "dist/index.js"]
