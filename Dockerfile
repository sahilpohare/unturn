FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS builder
RUN npm ci
COPY . .
RUN npm run build

FROM base AS runner
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/frontend/dist ./frontend/dist

# Default: run the API server
# Override CMD to run a worker: CMD ["node", "dist/temporal/worker.js"]
CMD ["node", "dist/main.js"]
