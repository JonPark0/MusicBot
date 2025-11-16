FROM node:18-alpine

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
    libc-dev

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

# Create audio directory
RUN mkdir -p /app/audio

# Set environment
ENV NODE_ENV=production

# Start the bot
CMD ["node", "dist/index.js"]
