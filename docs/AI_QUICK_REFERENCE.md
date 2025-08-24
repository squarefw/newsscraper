# NewsScraper AI 功能快速参考

## 🚀 快速启动

```bash
# 1. 启动Ollama服务
ollama serve

# 2. 下载推荐模型
ollama pull qwen3:8b

# 3. 运行AI增强的新闻采集
cd newsscraper
echo "2" | ./run-remote.sh
```

## ⚙️ 核心配置

```json
{
  "ai": {
    "enabled": true,
    "engine": "ollama",
    "ollama": {
      "baseUrl": "http://localhost:11434",
      "model": "qwen3:8b",
      "timeout": 600000
    },
    "tasks": [
      "translate",    // 翻译成中文
      "rewrite",      // 重写优化
      "summarize",    // 生成摘要
      "extract_keywords", // 提取关键词
      "categorize",   // 智能分类
      "sentiment"     // 情感分析
    ]
  }
}
```

## 🎯 AI任务效果

| 任务 | 输入示例 | 输出示例 |
|------|----------|----------|
| **translate** | "UK to recognise Palestine..." | "英国将承认巴勒斯坦..." |
| **rewrite** | 简短或直译的中文 | 完整、详细、符合中文习惯的长篇内容 |
| **summarize** | 长篇新闻内容 | 100字内精炼摘要 |
| **extract_keywords** | 新闻全文 | "政治,外交,巴勒斯坦,英国" |
| **categorize** | 新闻内容 | "国际" |
| **sentiment** | 新闻内容 | "中性" |

## 🤖 支持的AI引擎

| 引擎 | 优势 | 推荐场景 |
|------|------|----------|
| **Ollama** | 🏠 本地部署，隐私安全 | 开发测试，隐私敏感 |
| **OpenAI** | 🎯 高质量输出 | 生产环境，高质量要求 |
| **Gemini** | 🚀 多模态能力 | 复杂内容理解 |
| **SiliconFlow** | 🇨🇳 国内服务 | 网络稳定性要求高 |
| **OpenRouter** | 🔄 多模型统一接口 | 模型对比测试 |

## 📊 性能指标

- ⚡ **处理速度**: 30-60秒/篇 (取决于模型和任务数量)
- 🎯 **翻译准确率**: >95%
- 📝 **摘要质量**: 高质量，信息保真度>90%
- 🏷️ **分类准确率**: >85%
- 💾 **本地模型**: 无API成本，无网络依赖

## 🛠️ 常用命令

```bash
# 检查Ollama状态
curl http://localhost:11434/api/tags

# 查看AI配置
cat config/config.remote.json | jq '.ai'

# 测试AI功能
NODE_ENV=remote node test-ai.js

# 只运行AI处理
echo "2" | ./run-remote.sh
```

## 🔧 故障排除

| 问题 | 解决方案 |
|------|----------|
| AI代理创建失败 | `ollama serve` 启动服务 |
| 模型不存在 | `ollama pull qwen3:8b` |
| 处理超时 | 增加timeout或使用轻量模型 |
| 内存不足 | 使用更小的模型如qwen3:8b |

## 📈 使用建议

### 🎯 生产环境
```json
{
  "ai": {
    "enabled": true,
    "engine": "openai",
    "tasks": ["translate", "summarize", "categorize"]
  }
}
```

### 🧪 开发测试
```json
{
  "ai": {
    "enabled": true,
    "engine": "ollama",
    "tasks": ["translate", "rewrite"]
  }
}
```

### 💰 成本优化
```json
{
  "ai": {
    "enabled": true,
    "engine": "ollama",  // 免费本地处理
    "tasks": ["translate", "summarize"]  // 减少任务数量
  }
}
```

---

💡 **提示**: 查看完整文档 [`AI_FEATURES_GUIDE.md`](./AI_FEATURES_GUIDE.md) 了解更多详细信息。
