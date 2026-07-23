FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY client/package*.json client/
RUN npm --prefix client install
COPY . .
RUN npm --prefix client run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/package.json ./
COPY --from=build /app/client/dist ./client/dist
VOLUME /app/data
EXPOSE 3000
CMD ["node", "server/index.js"]
