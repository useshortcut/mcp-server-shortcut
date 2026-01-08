# Build with Node/npm (package-lock.json is canonical)
FROM node:20-slim AS base
WORKDIR /usr/src/app

# builder: install dev deps + build dist/
FROM base AS build
ENV HUSKY=0
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# runtime: prod deps + dist only
FROM node:20-slim AS runtime
WORKDIR /usr/src/app
ENV NODE_ENV=production
ENV HUSKY=0
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /usr/src/app/dist ./dist

USER node
EXPOSE 9292/tcp
CMD ["node", "dist/server-http.js"]
