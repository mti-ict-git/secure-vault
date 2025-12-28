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

ENV RUN_MIGRATIONS=false

CMD ["sh", "-c", "if [ \"$RUN_MIGRATIONS\" = \"true\" ]; then npm run migrate; fi; node dist/index.js"]
