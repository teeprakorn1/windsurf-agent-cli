FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

FROM node:20-slim
WORKDIR /app

# Create non-root user for security
RUN groupadd -r aiyu && useradd -r -g aiyu -d /app -s /sbin/nologin aiyu

COPY --from=builder /app ./

# Ensure non-root owns the app directory
RUN chown -R aiyu:aiyu /app

USER aiyu

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=5s \
  CMD node -e "const h=require('http');const r=h.request('http://localhost:3000/health',res=>process.exit(res.statusCode<500?0:1));r.on('error',()=>process.exit(1));r.setTimeout(3000,()=>{r.destroy();process.exit(1)});r.end()"

CMD ["node", "bin/server.js"]
