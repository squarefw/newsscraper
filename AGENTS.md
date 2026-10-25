# News Scraper 项目

基于 AI 的自动化新闻抓取、重写与发布系统，针对爱尔兰与中国相关新闻优化。

## 项目结构

- `src/ai/` - AI 处理模块（支持 OpenAI/DeepSeek 等多模型）
- `src/article/` - 新闻内容提取与过滤
- `src/services/` - 核心服务（定时调度、队列发现、批量推送）
- `src/wordpress/` - WordPress REST API 集成
- `src/browser/` - Puppeteer 浏览器自动化
- `config/` - 配置文件（AI prompts、RSS 源、API keys）

## 常用命令

```bash
# 启动统一服务（含定时任务）
npm run service

# 手动执行一次完整流程
npm run cron

# 发现并队列化新闻
npm run discover
```

## 部署

- 服务器：阿里云 `8.208.23.37`
- 容器化部署：`./deploy-enhanced.sh`
- WordPress 站点：`http://8.208.23.37`

## 注意事项

- 使用 Puppeteer Stealth 插件绕过反爬
- Google News URL 需要特殊解码（src/utils/googleNewsDecoder.js）
- AI 处理支持多模型切换（src/ai/multiAIManager.js）
