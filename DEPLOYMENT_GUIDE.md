# NewsScraper 部署指南 (230 服务器)

本文档详细说明了如何将 NewsScraper 系统部署到您的内网服务器 `192.168.1.230`。

## ⚙️ 环境依赖

1. **目标服务器 (230)**:
   - 操作系统: Debian GNU/Linux (ARM64)
   - 软件: Docker, Docker Compose (V2)
2. **部署机 (本地)**:
   - 已配置 SSH 密钥登录 `weifang@192.168.1.230`
   - 安装有 `tar`, `scp`, `ssh`

## 🚀 部署流程

### 1. 一键增强部署 (推荐)
使用 `deploy-enhanced.sh` 脚本，它包含备份、传输、构建和完整环境测试：

```bash
chmod +x deploy-enhanced.sh
./deploy-enhanced.sh
```

**脚本内部动作：**
- 检查本地关键文件完整性。
- 通过 SSH 备份服务器端的旧文件（存放于 `backups/` 文件夹）。
- 打包并传输代码。
- 在远程执行 `docker build`（注意：Dockerfile 包含 Python 依赖安装，初次构建约需 10-20 分钟）。
- 使用 `docker-compose.arm.yml` 启动容器并自动清理孤立容器。
- 自动运行 `docker-test.js` 验证 Puppeteer 和 Python 解码是否正常。

### 2. 极简部署 (快速更新)
如果您只是修改了简单的 JS 代码，不需要重建镜像或备份：

```bash
chmod +x simple-deploy.sh
./simple-deploy.sh
```

## 📋 运维常用命令

在服务器端 (`/home/weifang/newsscraper`) 执行：

- **查看主服务日志**:
  `docker compose -f docker-compose.arm.yml logs -f newsscraper`
- **重启服务**:
  `docker compose -f docker-compose.arm.yml restart`
- **查看容器健康状态**:
  `docker compose -f docker-compose.arm.yml ps`
- **手动触发一次任务 (测试模式)**:
  `docker exec -it newsscraper-unified node src/services/unified-service-cron.js --test`

## 🔄 调度说明

系统内置了 `src/services/unified-service-cron.js`，启动后会常驻后台。
- **调度时间**: 每天凌晨 **00:00** (时区: `Europe/Dublin`)。
- **任务内容**: 完整完成发现、去重、解码、资质筛选、翻译、重写、正式发布。

## ⚠️ 注意事项

- **时区**: 容器内部时区已锁定为 `Europe/Dublin`，确保定时任务符合爱尔兰当地时间。
- **发布状态**: 当前默认发布状态为 `publish`（正式发布），如需测试请修改 `config/config.remote-aliyun.json` 中的 `defaultStatus`。
