# Stage 1: Build frontend
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
RUN npm run build

# Stage 2: Production server
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache tini
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server/src ./src
COPY server/tsconfig.json ./
COPY --from=client-build /app/client/dist ./public
EXPOSE 3001
ENTRYPOINT ["tini", "--"]
CMD ["npx", "tsx", "src/index.ts"]
