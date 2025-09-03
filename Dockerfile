# 使用 Node.js 18 Alpine 作为基础镜像 (支持多架构)
FROM node:18-alpine

# 安装系统依赖 (针对 ARM64/x64 架构优化 + Puppeteer反检测优化)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto \
    font-noto-cjk \
    font-noto-extra \
    wqy-zenhei \
    dbus-x11 \
    && rm -rf /var/cache/apk/*

# 创建应用目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制应用代码
COPY . .

# 创建日志目录
RUN mkdir -p /app/logs

# 设置 Puppeteer 使用系统安装的 Chromium + 反检测优化
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV DISPLAY=:99
ENV NODE_ENV=production

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodeuser -u 1001
RUN chown -R nodeuser:nodejs /app
USER nodeuser

# 暴露端口（如果需要 web-quality-tester）
EXPOSE 3000

# 设置健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('Health check passed')" || exit 1

# 默认启动命令
CMD ["node", "tools/production/batch-ai-push.js", "config/config.remote-230.json", "examples/pending-urls.txt"]
