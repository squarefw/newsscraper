# News Scraper - Production System

[![GitHub](https://img.shields.io/badge/GitHub-squarefw%2Fnewsscraper-blue?logo=github)](https://github.com/squarefw/newsscraper)
[![Security](https://img.shields.io/badge/Security-API%20Keys%20Protected-green?logo=shield)](docs/API_KEYS_SETUP.md)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

简化的生产环境新闻发现和AI处理系统。

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 配置API密钥
```bash
# 复制密钥模板文件
cp config/api-keys.json config/api-keys.local.json

# 编辑并填入真实API密钥
nano config/api-keys.local.json
```

### 3. 启动系统
```bash
# 启动新闻发现系统
npm run start

# 或单独运行组件
npm run discovery  # 新闻发现
npm run push      # 内容推送
```

## 安全配置

⚠️ **重要**: 所有API密钥已移至独立配置文件 `config/api-keys.local.json`，该文件不会上传到Git。

详细配置说明请参见: [API密钥配置指南](docs/API_KEYS_SETUP.md)

## 项目结构

```
├── config/
│   ├── api-keys.json            # API密钥模板文件（Git追踪）
│   ├── api-keys.local.json      # 实际密钥文件（Git忽略）
│   ├── config-loader.js         # 配置加载器
│   ├── config.remote-230.json   # 主配置文件
│   ├── targets.json             # 新闻源配置
│   └── ai-prompts.json          # AI提示配置
├── tools/production/
│   ├── discover-and-queue.js    # 新闻发现主程序
│   └── batch-ai-push-enhanced.js # 内容处理推送
├── utils/                       # 核心工具模块
├── examples/
│   └── pending-urls.txt         # URL队列文件
├── docs/
│   └── API_KEYS_SETUP.md        # API密钥配置指南
└── package.json
```

## 配置说明

编辑 `config/config.remote-230.json` 配置：
- WordPress 连接信息
- AI 引擎设置 
- 新闻发现参数

编辑 `config/targets.json` 配置新闻源。

## 运行流程

1. `discover-and-queue.js` 监控新闻源，发现新文章
2. AI 去重筛选，将新文章URL写入队列
3. 自动调用 `batch-ai-push-enhanced.js` 处理内容并推送到WordPress

## 系统要求

- Node.js 16+
- 网络连接（访问AI服务和新闻源）
- WordPress 站点（用于内容推送）
