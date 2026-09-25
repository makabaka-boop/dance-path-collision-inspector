# syntax=docker/dockerfile:1

# ---- 测试阶段：运行 Vitest 几何对拍 ----
FROM node:20-alpine AS test
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json vite.config.ts ./
COPY src ./src
COPY tests ./tests
CMD ["npm", "test"]

# ---- 构建阶段：Vue + TypeScript 静态产物 ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# ---- 运行阶段：nginx 提供 stage 页面 ----
FROM nginx:1.27-alpine AS stage
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null 2>&1 || exit 1
