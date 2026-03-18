FROM node:22-slim

# Install system dependencies
RUN apt-get update && apt-get install -y python3 make g++ git && rm -rf /var/lib/apt/lists/*

# Install OpenClaw globally
RUN npm install -g openclaw

# Set up the working directory for the UI
WORKDIR /app

# Copy the OpenClaw configuration from openclaw-config into the root container home directory
COPY ./openclaw-config /root/.openclaw

# Copy the UI package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the UI code
COPY . .

# Create the environment file specifically for the Cloud Container
RUN echo 'WORKSPACE_PATH=/root/.openclaw/master_workspace' > .env.production && \
    echo 'OPENCLAW_BIN=/usr/local/bin/openclaw' >> .env.production && \
    echo 'OPENCLAW_GATEWAY_PORT=18789' >> .env.production

# Build the Next.js frontend
RUN npm run build

# Expose both the UI and Gateway ports
EXPOSE 3000 18789

# Start script
CMD ["sh", "start-cloud.sh"]
