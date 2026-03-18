FROM node:22-slim
RUN apt-get update && apt-get install -y python3 make g++ git && rm -rf /var/lib/apt/lists/*
RUN npm install -g openclaw
WORKDIR /root/.openclaw
COPY . .
CMD ["openclaw", "gateway"]
