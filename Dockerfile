FROM node:22.12.0-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22.12.0-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/dist/migrate.js ./server/dist/migrate.js
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev && chown -R app:app /app
USER app
EXPOSE 3001
CMD ["node", "server/dist/index.js"]
