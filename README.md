# News Scraper - Production System (V4 Enhanced)

基于 AI 的自动化新闻抓取、重写与发布系统，针对爱尔兰与中国相关新闻进行了深度优化。

## 🌟 核心特性

- **三级 Google News 解码系统**：支持 JS 快速解码、Python 桥接解码和 Puppeteer 模拟器降级解码，确保 100% 的 URL 解析成功率。
- **智能内容资质过滤**：针对“爱尔兰”及“中爱相关”严肃新闻进行多维度 AI 筛选，自动过滤杂质国际新闻。
- **资深记者风格重写**：采用资深驻外记者风格对新闻进行重构，保留深度与严肃性。
- **全自动媒体处理**：自动抓取远程特色图片并实时同步上传至 WordPress 媒体库，实现首页缩略图关联。
- **容器化定时调度**：集成 Docker 与内部 Cron 调度，实现爱尔兰时间每日 00:00 自动触发全流程。

## 📁 项目结构

```
├── src/
│   ├── ai/                    # AI 处理逻辑 (Processor, Manager)
│   ├── article/               # 内容提取与资质筛选 (Extractor, Filter)
│   ├── browser/               # 浏览器环境与 Puppeteer 解码器
│   ├── services/              # 核心服务 (Cron 调度, 队列发现, 批量推送)
│   ├── utils/                 # 通用工具 (Google News 解码器, Markdown 等)
│   └── wordpress/             # WordPress API 与镜像上传连接器
├── config/
│   ├── ai-prompts.json        # AI 角色与任务提示词模板
│   ├── config.remote-aliyun.json # 阿里云 WordPress 生产配置
│   └── targets.json           # RSS 与 Google News 监控源配置
├── Dockerfile                 # 包含 Puppeteer 和 Python 依赖的容器定义
├── deploy-enhanced.sh         # 一键部署至 230 服务器的增强脚本
└── simple-deploy.sh           # 极简快速部署脚本
```

## 🚀 快速开始

### 1. 环境准备
确保您的开发环境或服务器已安装 Node.js 18+ 和 Docker。

### 2. 部署到 230 服务器
```bash
./deploy-enhanced.sh
```
该脚本会自动完成：
- 代码打包与传输
- 远程 Docker 镜像构建（包含 Python 依赖）
- 启动 `unified-service-cron` 调度任务

### 3. 本地运行与测试
```bash
# 安装依赖
npm install

# 手动执行一次完整流程 (发现 -> AI -> 发布)
node src/services/unified-service-cron.js --test
```

## 📖 核心文档

- [API 密钥配置指南](docs/API_KEYS_SETUP.md)
- [部署指南](DEPLOYMENT_GUIDE.md)
- [快速导航](QUICKSTART.md)

## 🛠️ 技术栈

- **Runtime**: Node.js, Python (googlenewsdecoder)
- **Engine**: Puppeteer (Stealth), Cheerio
- **Integration**: WordPress REST API / XML-RPC
- **AI**: 支持 OpenAI, DeepSeek, Claude 等多模型接入
