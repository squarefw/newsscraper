# 批量AI处理与推送工具使用指南

## 概述

`batch-ai-push.js` 是 NewsScraper 的正式生产版本批量处理工具，它可以：

1. 从文件中读取多个新闻URL
2. 自动提取新闻内容（标题和正文）
3. 使用AI进行多种处理（翻译、重写、摘要、关键词提取、分类、情感分析）
4. **将处理结果推送到远程API服务器**

## 功能特点

### 🚀 与测试版本的区别

| 功能 | 测试版本 (batch-ai-url_test.js) | 正式版本 (batch-ai-push.js) |
|------|--------------------------------|------------------------------|
| 内容提取 | ✅ | ✅ |
| AI处理 | ✅ | ✅ |
| 生成本地报告 | ✅ | ❌ |
| 推送到API | ❌ | ✅ |
| 适用场景 | 测试和调试 | 生产环境 |

### 🎯 核心功能

- **智能内容提取**: 支持多种新闻网站的内容提取
- **AI处理流水线**: 支持翻译、重写、摘要、关键词提取、分类、情感分析
- **API推送**: 将处理后的新闻文章推送到远程服务器
- **批量处理**: 支持一次处理多个URL
- **错误处理**: 完善的错误处理和重试机制
- **进度跟踪**: 实时显示处理进度和状态

## 使用方法

### 1. 基本使用

```bash
# 使用示例URL文件
node tools/batch-ai-push.js examples/sample-urls.txt

# 使用自定义URL文件
node tools/batch-ai-push.js my-urls.txt
```

### 2. 创建URL文件

如果没有提供URL文件，脚本会询问是否创建示例文件：

```bash
node tools/batch-ai-push.js
# 选择 y 创建示例文件，然后编辑 examples/sample-urls.txt
```

### 3. URL文件格式

```text
# NewsScraper 批量处理与推送URL列表
# 以 # 开头的行为注释，会被忽略
# 每行一个URL

# BBC新闻示例
https://www.bbc.com/news/world-europe-68123456
https://www.bbc.com/news/technology-68234567

# RTE新闻示例
https://www.rte.ie/news/world/2025/0730/1234567-example-news/
https://www.rte.ie/news/business/2025/0730/1234568-business-news/
```

## 配置要求

### 1. API配置

确保 `config/config.remote.json` 中配置了正确的API信息：

```json
{
  "api": {
    "baseUrl": "http://your-api-server.com/api",
    "apiKey": "YOUR_API_KEY"
  },
  "ai": {
    "enabled": true,
    "engine": "openrouter",
    "tasks": ["translate", "rewrite", "summarize", "extract_keywords", "categorize", "sentiment"]
  }
}
```

### 2. AI配置

根据使用的AI引擎配置相应参数：

```json
{
  "ai": {
    "enabled": true,
    "engine": "openrouter",
    "tasks": ["translate", "rewrite", "summarize", "extract_keywords", "categorize", "sentiment"],
    "openrouter": {
      "apiKey": "YOUR_API_KEY",
      "model": "qwen/qwen3-235b-a22b:free",
      "baseUrl": "https://openrouter.ai/api/v1"
    }
  }
}
```

## 处理流程

### 1. 内容提取阶段
```
📡 访问URL → 解析HTML → 提取标题和正文 → ✅ 提取成功
```

### 2. AI处理阶段
```
🤖 AI处理流程开始
   1/6 执行 TRANSLATE - 翻译    → ✅ 完成
   2/6 执行 REWRITE - 重写      → ✅ 完成
   3/6 执行 SUMMARIZE - 摘要    → ✅ 完成
   4/6 执行 EXTRACT_KEYWORDS - 关键词提取 → ✅ 完成
   5/6 执行 CATEGORIZE - 智能分类 → ✅ 完成
   6/6 执行 SENTIMENT - 情感分析 → ✅ 完成
```

### 3. API推送阶段
```
📤 准备推送到API → 构建文章对象 → 发送POST请求 → ✅ 推送成功
```

## 输出示例

```
🎉 批量处理与推送完成！
=====================================
📊 URL处理统计:
   ✅ 成功提取: 4/4 (100.0%)
   ❌ 提取失败: 0/4
📊 API推送统计:
   ✅ 推送成功: 4/4 (100.0%)
   ❌ 推送失败: 0/4
📊 AI任务统计:
   ✅ 成功: 24/24 (100.0%)
   ❌ 失败: 0/24
⏱️  总耗时: 120秒
📈 平均处理时间: 30秒/URL

📚 成功推送的文章:
   1. 科技新闻标题 (ID: abc123)
   2. 政治新闻标题 (ID: def456)
   3. 经济新闻标题 (ID: ghi789)
   4. 体育新闻标题 (ID: jkl012)
```

## API数据结构

推送到API的文章对象结构：

```json
{
  "title": "处理后的文章标题",
  "content": "处理后的文章内容",
  "categoryId": "tech",
  "tags": ["关键词1", "关键词2", "关键词3"],
  "featuredImage": null,
  "metadata": {
    "originalUrl": "https://example.com/news/123",
    "aiProcessed": true,
    "processingDate": "2025-08-01T14:30:00.000Z",
    "summary": "文章摘要",
    "sentiment": "积极",
    "aiResults": [
      {
        "task": "translate",
        "success": true,
        "duration": 2500
      }
    ]
  }
}
```

## 错误处理

### 常见错误及解决方案

1. **API配置错误**
   ```
   ❌ API配置不完整，请检查 config.remote.json 中的 api.baseUrl 和 api.apiKey
   ```
   **解决**: 检查配置文件中的API设置

2. **AI代理创建失败**
   ```
   ❌ AI代理创建失败
   ```
   **解决**: 检查AI引擎配置和网络连接

3. **内容提取失败**
   ```
   ❌ 提取失败: 无法提取有效的新闻内容
   ```
   **解决**: 检查URL是否有效，网站是否可访问

4. **API推送失败**
   ```
   ❌ 推送失败: API Error: 401 - {"error":"Unauthorized"}
   ```
   **解决**: 检查API密钥是否正确

## 性能优化建议

1. **批量大小**: 建议每批处理10-50个URL
2. **并发控制**: 脚本内置3秒延迟，避免请求过快
3. **网络超时**: 默认30秒超时，可根据需要调整
4. **错误重试**: 对于临时网络错误，可重新运行失败的URL

## 监控和日志

- 所有操作都有详细的控制台输出
- API推送结果会显示响应ID
- 失败的URL和错误信息会在最后汇总显示
- 可配合系统日志进行长期监控

## 最佳实践

1. **测试先行**: 使用小批量URL先测试
2. **配置验证**: 确保所有配置正确后再大批量处理
3. **定期检查**: 监控API推送成功率
4. **备份数据**: 重要URL列表建议备份
5. **错误处理**: 对失败的URL单独处理

## 与其他工具的配合

- 可与 `batch-ai-url_test.js` 配合使用：先测试，后推送
- 可与定时任务配合，实现自动化新闻处理
- 可与监控系统集成，实现故障告警
