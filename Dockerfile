FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app ./
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "bin/server.js"]
