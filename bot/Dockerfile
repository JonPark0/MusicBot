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

# Install dependencies
RUN npm ci --only=production && \
    npm install -g typescript

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Create audio directory
RUN mkdir -p /app/audio

# Set environment
ENV NODE_ENV=production

# Start the bot
CMD ["node", "dist/index.js"]
