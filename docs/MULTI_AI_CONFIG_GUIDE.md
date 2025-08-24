# 多AI引擎任务分配配置指南

## 概述

NewsScraper 现在支持多AI引擎分工合作，不同的AI任务可以由不同的AI引擎处理，实现最优的处理效果。

## 配置结构

### 完整配置示例 (config.remote-230.json)

```json
{
  "ai": {
    "enabled": true,
    "defaultEngine": "ollama",
    "taskEngines": {
      "translate": "openai",
      "rewrite": "siliconflow", 
      "summarize": "gemini",
      "extract_keywords": "ollama",
      "categorize": "openrouter",
      "sentiment": "ollama",
      "custom_title_translate": "openai",
      "custom_title_generate": "siliconflow"
    },
    "fallbackStrategy": "useDefault",
    "engines": {
      "ollama": {
        "baseUrl": "http://localhost:11434",
        "model": "qwen2.5:7b",
        "maxTokens": 2000,
        "temperature": 0.3,
        "timeout": 60000
      },
      "openai": {
        "apiKey": "YOUR_OPENROUTER_API_KEY",
        "model": "gpt-4o-mini",
        "maxTokens": 4000,
        "temperature": 0.3,
        "timeout": 30000
      },
      "gemini": {
        "apiKey": "YOUR_GEMINI_API_KEY", 
        "model": "gemini-pro",
        "maxTokens": 4000,
        "temperature": 0.3,
        "timeout": 30000
      },
      "siliconflow": {
        "apiKey": "YOUR_SILICONFLOW_API_KEY",
        "baseUrl": "https://api.siliconflow.cn/v1",
        "model": "deepseek-ai/deepseek-chat",
        "maxTokens": 4000,
        "temperature": 0.3,
        "timeout": 30000
      },
      "openrouter": {
        "apiKey": "YOUR_OPENROUTER_API_KEY",
        "baseUrl": "https://openrouter.ai/api/v1",
        "model": "qwen/qwen-2.5-72b-instruct:free",
        "maxTokens": 4000,
        "temperature": 0.3,
        "timeout": 30000
      }
    },
    "tasks": [
      "translate",
      "rewrite", 
      "summarize",
      "extract_keywords",
      "categorize",
      "sentiment"
    ]
  }
}
```

## 配置说明

### 1. 核心设置

- **`enabled`**: 启用AI功能
- **`defaultEngine`**: 默认AI引擎，当任务没有指定引擎或指定引擎不可用时使用
- **`fallbackStrategy`**: 失败回退策略
  - `"useDefault"`: 使用默认引擎
  - `"skip"`: 跳过任务
  - `"retry"`: 重试

### 2. 任务分配 (taskEngines)

每个任务可以指定使用不同的AI引擎：

| 任务 | 建议引擎 | 说明 |
|------|----------|------|
| `translate` | openai | 翻译质量高 |
| `rewrite` | siliconflow | 重写能力强 |
| `summarize` | gemini | 摘要生成优秀 |
| `extract_keywords` | ollama | 本地处理，快速 |
| `categorize` | openrouter | 分类准确 |
| `sentiment` | ollama | 本地处理，快速 |
| `custom_title_translate` | openai | 标题翻译 |
| `custom_title_generate` | siliconflow | 标题生成 |

### 3. 引擎配置 (engines)

每个AI引擎需要完整的配置信息：

#### Ollama (本地)
```json
"ollama": {
  "baseUrl": "http://localhost:11434",
  "model": "qwen2.5:7b",
  "maxTokens": 2000,
  "temperature": 0.3,
  "timeout": 60000
}
```

#### OpenAI
```json
"openai": {
  "apiKey": "YOUR_OPENROUTER_API_KEY",
  "model": "gpt-4o-mini",
  "maxTokens": 4000,
  "temperature": 0.3,
  "timeout": 30000
}
```

#### Google Gemini
```json
"gemini": {
  "apiKey": "YOUR_GEMINI_API_KEY", 
  "model": "gemini-pro",
  "maxTokens": 4000,
  "temperature": 0.3,
  "timeout": 30000
}
```

#### SiliconFlow
```json
"siliconflow": {
  "apiKey": "YOUR_SILICONFLOW_API_KEY",
  "baseUrl": "https://api.siliconflow.cn/v1",
  "model": "deepseek-ai/deepseek-chat",
  "maxTokens": 4000,
  "temperature": 0.3,
  "timeout": 30000
}
```

#### OpenRouter
```json
"openrouter": {
  "apiKey": "YOUR_OPENROUTER_API_KEY",
  "baseUrl": "https://openrouter.ai/api/v1",
  "model": "qwen/qwen-2.5-72b-instruct:free",
  "maxTokens": 4000,
  "temperature": 0.3,
  "timeout": 30000
}
```

## 运行效果

启用多AI引擎后，系统会显示详细的任务分配信息：

```
🎯 AI分工配置:
   默认引擎: ollama
   可用引擎: ollama, openai, gemini, siliconflow, openrouter
   任务分配:
     translate -> openai
     rewrite -> siliconflow
     summarize -> gemini
     extract_keywords -> ollama
     categorize -> openrouter
     sentiment -> ollama
```

每个任务执行时会显示使用的AI引擎：

```
🎯 Task 'translate' assigned to AI engine: openai
🎯 Task 'rewrite' assigned to AI engine: siliconflow
🎯 Task 'summarize' assigned to AI engine: gemini
```

## 使用方法

```bash
# 使用配置文件运行
node tools/production/batch-ai-push-enhanced.js config/config.remote-230.json examples/sample-urls.txt
```

## 优势

1. **专业化处理**: 每个AI引擎处理最擅长的任务
2. **灵活配置**: 可以根据需要调整任务分配
3. **故障隔离**: 单个AI引擎失败不影响其他任务
4. **成本控制**: 可以将简单任务分配给本地模型，复杂任务使用付费API
5. **性能优化**: 并行处理提高整体效率

## 注意事项

1. 确保所有配置的AI引擎都可用
2. API密钥需要正确配置
3. 本地Ollama需要先启动服务
4. 网络连接要稳定
5. 注意API调用限制和费用
