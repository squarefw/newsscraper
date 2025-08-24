# AI引擎配置指南

## 概述

NewsScraper支持5种AI引擎，每种引擎都有其特定的配置要求和优势。

## 支持的AI引擎

### 1. Ollama (本地部署)
```json
"ai": {
  "enabled": true,
  "engine": "ollama",
  "ollama": {
    "baseUrl": "http://localhost:11434",
    "model": "qwen3:8b",
    "timeout": 600000
  }
}
```

**优势:**
- 完全本地运行，数据隐私保护
- 免费使用，无API费用
- 支持多种开源模型

**推荐模型:**
- `qwen3:8b` - 中文支持优秀
- `llama3.1:8b` - 英文性能强
- `gemma2:9b` - 平衡性能

**设置要求:**
- 需要本地安装Ollama
- 需要足够的显卡内存 (8GB+)

### 2. OpenAI
```json
"ai": {
  "enabled": true,
  "engine": "openai",
  "openai": {
    "apiKey": "YOUR_OPENAI_API_KEY",
    "model": "gpt-4o-mini",
    "maxTokens": 4000,
    "temperature": 0.3
  }
}
```

**优势:**
- 业界领先的AI性能
- 强大的多语言支持
- 稳定可靠的API服务

**推荐模型:**
- `gpt-4o-mini` - 性价比最高
- `gpt-4o` - 最强性能
- `gpt-3.5-turbo` - 经济选择

**费用:**
- 按token计费
- 支持预付费和后付费

### 3. Google Gemini
```json
"ai": {
  "enabled": true,
  "engine": "gemini",
  "gemini": {
    "apiKey": "YOUR_GEMINI_API_KEY",
    "model": "gemini-pro",
    "maxTokens": 4000,
    "temperature": 0.3
  }
}
```

**优势:**
- Google技术支持
- 优秀的多模态能力
- 有免费额度

**推荐模型:**
- `gemini-pro` - 标准版本
- `gemini-pro-vision` - 支持图像

**费用:**
- 有免费配额
- 超额按使用计费

### 4. SiliconFlow (国产AI)
```json
"ai": {
  "enabled": true,
  "engine": "siliconflow",
  "siliconflow": {
    "apiKey": "YOUR_SILICONFLOW_API_KEY",
    "model": "deepseek-ai/deepseek-chat",
    "maxTokens": 4000,
    "temperature": 0.3
  }
}
```

**优势:**
- 国产AI服务，网络稳定
- 价格相对便宜
- 中文优化较好

**推荐模型:**
- `deepseek-ai/deepseek-chat` - 综合能力强
- `Qwen/Qwen2.5-7B-Instruct` - 轻量级选择

**费用:**
- 价格相对便宜
- 支持包月套餐

### 5. OpenRouter (AI聚合平台)
```json
"ai": {
  "enabled": true,
  "engine": "openrouter",
  "openrouter": {
    "apiKey": "YOUR_OPENROUTER_API_KEY",
    "model": "qwen/qwen3-235b-a22b:free",
    "maxTokens": 4000,
    "temperature": 0.3
  }
}
```

**优势:**
- 聚合多种AI模型
- 有免费模型可选
- 统一的API接口

**推荐模型:**
- `qwen/qwen3-235b-a22b:free` - 免费强模型
- `anthropic/claude-3.5-sonnet` - 付费顶级模型
- `meta-llama/llama-3.1-8b-instruct:free` - 免费选择

**费用:**
- 有免费模型
- 付费模型价格透明

## 配置切换

只需修改配置文件中的 `engine` 字段即可切换AI引擎：

```json
"ai": {
  "enabled": true,
  "engine": "ollama",  // 改为: openai, gemini, siliconflow, openrouter
  // ... 其他配置
}
```

## 性能对比

| 引擎 | 中文能力 | 英文能力 | 速度 | 成本 | 隐私性 |
|------|----------|----------|------|------|--------|
| Ollama | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| OpenAI | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| Gemini | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| SiliconFlow | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| OpenRouter | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |

## 推荐使用场景

### 开发测试环境
- **推荐**: Ollama + qwen3:8b
- **原因**: 免费、隐私、稳定

### 小规模生产环境
- **推荐**: OpenRouter + 免费模型
- **原因**: 免费额度、多模型选择

### 大规模生产环境
- **推荐**: OpenAI + gpt-4o-mini
- **原因**: 稳定性最高、性能优秀

### 中文为主的应用
- **推荐**: SiliconFlow + deepseek-chat
- **原因**: 中文优化、价格合理

## 获取API密钥

### OpenAI
1. 访问 https://platform.openai.com/
2. 注册账号并验证
3. 在API Keys页面生成密钥

### Gemini
1. 访问 https://ai.google.dev/
2. 使用Google账号登录
3. 获取API密钥

### SiliconFlow
1. 访问 https://siliconflow.cn/
2. 注册账号
3. 在控制台获取API密钥

### OpenRouter
1. 访问 https://openrouter.ai/
2. 注册账号
3. 在Keys页面生成密钥

## 常见问题

### Q: 如何选择合适的AI引擎？
A: 根据需求选择：
- 预算有限 → Ollama或OpenRouter免费模型
- 性能要求高 → OpenAI
- 中文为主 → SiliconFlow
- 数据敏感 → Ollama

### Q: 可以同时配置多个AI引擎吗？
A: 是的，可以配置多个，但同时只能使用一个（通过engine字段指定）

### Q: 如何监控AI使用量和费用？
A: 各平台都有使用量监控界面，建议设置使用限额。

---

*最后更新: 2025-08-10*
