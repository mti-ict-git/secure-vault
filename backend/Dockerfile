FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts

RUN npm run build

ENV NODE_ENV=production
EXPOSE 8082

CMD ["sh", "-c", "npm run migrate && node dist/index.js"]

