# NewsScraper

智能新闻抓取器，支持AI驱动的内容处理和多平台推送。

## 功能特性

### 🔄 智能新闻抓取
- **传统网站爬取**: 支持自定义CSS选择器抓取
- **AI驱动搜索**: 使用AI智能发现和提取新闻内容
- **多媒体支持**: 自动提取文章图片和视频

### 🤖 AI集成
- **多引擎支持**: Ollama、OpenRouter、Gemini、OpenAI、SiliconFlow
- **内容增强**: 自动翻译、重写、摘要、关键词提取
- **智能分类**: 自动分类和情感分析

### 📤 多平台推送
- **自定义API**: 推送到自定义后端API
- **WordPress集成**: 自动推送到WordPress站点
- **并行推送**: 同时推送到多个平台
- **智能分类**: 自动创建和管理WordPress分类和标签

### 🛡️ 内容质量保证
- **去重机制**: SHA256哈希检测重复内容
- **关键词过滤**: 基于配置的内容相关性过滤
- **回退机制**: AI失败时自动降级到传统HTML解析

## 📁 项目结构

```
newsscraper/
├── src/                 # 核心源代码
│   ├── ai/             # AI引擎实现
│   ├── services/       # 业务服务
│   └── *.ts            # 主要模块
├── config/             # 配置文件
├── tools/              # 工具和脚本
│   ├── test-ai.js           # 基础AI测试
│   ├── test-ai-url.js       # 单URL测试
│   ├── batch-ai-url_test.js # 批量处理测试版
│   ├── batch-ai-push.js     # 批量处理生产版
│   └── *.js                 # 其他工具
├── docs/               # 详细文档
├── examples/           # 示例文件
├── reports/            # 测试报告
└── logs/               # 日志文件
```

## 快速开始

### 安装依赖
```bash
npm install
```

### 配置设置
编辑配置文件 `config/config.development.json`：
```json
{
  "api": {
    "baseUrl": "http://localhost:3000/api",
    "apiKey": "your-api-key"
  },
  "ai": {
    "enabled": true,
    "engine": "ollama",
    "ollama": {
      "baseUrl": "http://localhost:11434",
      "model": "llama3.1:8b"
    },
    "tasks": ["translate", "rewrite", "summarize"]
  },
  "filter": {
    "keywords": ["科技", "新闻", "AI"]
  }
}
```

### 运行
```bash
# 开发模式
npm run dev

# 测试模式 (运行一次所有目标)
TEST_MODE=true npm run dev

# 生产模式
npm start
```

## 配置详解

### 网站抓取配置
在 `config/targets.json` 中配置目标网站：
```json
[
  {
    "name": "示例新闻网站",
    "url": "https://example-news.com",
    "schedule": "0 */6 * * *",
    "aiSearchEnabled": true,
    "aiExtractionEnabled": true,
    "selectors": {
      "title": "h1.title",
      "content": ".article-content"
    }
### AI引擎配置

支持多个AI引擎，可按需启用：

```json
{
  "ai": {
    "enabled": true,
    "engine": "ollama",
    "ollama": {
      "baseUrl": "http://localhost:11434",
      "model": "llama3.1:8b",
      "timeout": 600000
    },
    "tasks": ["translate", "rewrite", "summarize", "extract_keywords"]
  }
}
```

## 工作流程

### 网站抓取流程
1. **发现阶段**: AI搜索或CSS选择器获取文章链接
2. **提取阶段**: AI解析或DOM选择器提取内容
3. **回退机制**: AI失败时使用传统HTML解析
4. **质量控制**: 去重、过滤、AI增强
5. **推送**: 发送到后端API

## 监控和调试

### 日志文件
- `logs/combined.log`: 所有日志
- `logs/error.log`: 错误日志

### 调试模式
```bash
DEBUG=* npm run dev
```

### 测试AI功能
```bash
# 基础AI功能测试
node tools/test/test-ai.js

# 单URL实战测试
node tools/test/test-ai-url.js

# 批量URL处理测试
node tools/test/batch-ai-url_test.js examples/sample-urls.txt

# 批量URL处理并推送到API (生产环境)
node tools/production/batch-ai-push.js examples/sample-urls.txt
```

### 🚀 生产环境工具

- **`batch-ai-push.js`**: 正式版批量处理工具
  - 从文件读取URL列表
  - AI处理新闻内容
  - 推送结果到远程API
  - 适用于生产环境大批量处理

- **`batch-ai-url_test.js`**: 测试版批量处理工具
  - 生成详细的本地报告文件
  - 适用于测试和调试

### AI处理脚本说明

#### 1. 基础测试 (`tools/test/test-ai.js`)
- 测试预设内容的AI处理
- 验证各AI任务的基本功能
- 快速检查AI引擎状态

#### 2. 单URL测试 (`tools/test/test-ai-url.js`) 
- 🆕 **实际网页内容测试**
- 输入任意新闻网页URL
- 执行完整AI处理流程
- 生成详细测试报告

#### 3. 批量处理 (`tools/test/batch-ai-url_test.js`)
- 🔥 **批量URL处理**
- 从文件读取多个新闻URL
- 顺序执行所有AI任务
- 生成汇总报告包含原文和最终结果

详细使用说明请参考：[批量AI处理指南](./docs/BATCH_AI_GUIDE.md)

## 最佳实践

### 优化建议
1. **合理设置调用频率**: 使用cron表达式控制抓取频率
2. **启用缓存**: 避免重复处理相同内容
3. **监控AI使用量**: 设置API使用量告警
4. **错误处理**: 实现重试机制和降级策略

## 部署

### Docker部署
```bash
# 构建镜像
docker build -t newsscraper .

# 运行容器
docker run -d --name newsscraper newsscraper
```

### 环境变量
生产环境推荐使用环境变量管理API密钥：
```bash
## 部署

### Docker 部署
```bash
# 构建镜像
docker build -t newsscraper .

# 运行容器
docker run -d \
  --name newsscraper \
  -v $(pwd)/config:/app/config \
  -v $(pwd)/logs:/app/logs \
  newsscraper
```

### 环境变量
```bash
export NODE_ENV=production
export API_KEY=your_api_key
```

## 故障排除

### 常见问题

**Q: AI处理超时**
A: 检查网络连接，考虑增加超时时间或使用其他AI引擎

**Q: 内容重复**
A: 检查去重机制配置，确保SHA256哈希正常工作

**Q: 抓取失败**
A: 检查目标网站是否可访问，CSS选择器是否正确

### 性能优化

1. **并发控制**: 限制同时处理的文章数量
2. **内容缓存**: 缓存已处理的内容避免重复处理
3. **批量处理**: 批量推送文章到API减少请求次数

## 贡献

欢迎提交Issue和Pull Request。

## 许可证

MIT License

## 更新日志

### v2.1.0
- 🔥 移除外部新闻API支持，专注于网站抓取
- ✨ 增强AI驱动的内容发现和提取
- 🐛 优化错误处理和回退机制
- 🔧 简化配置结构
