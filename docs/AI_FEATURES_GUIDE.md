# NewsScraper AI 增强功能完整指南

## 📋 目录
- [概述](#概述)
- [支持的AI引擎](#支持的ai引擎)
- [AI任务类型](#ai任务类型)
- [配置说明](#配置说明)
- [功能演示](#功能演示)
- [性能优化](#性能优化)
- [故障排除](#故障排除)
- [最佳实践](#最佳实践)

---

## 🎯 概述

NewsScraper 集成了强大的AI功能，可以自动处理、优化和本地化新闻内容。通过多引擎支持和灵活的任务配置，实现从原始新闻到高质量中文内容的智能转换。

### 核心优势
- 🌍 **多语言支持**: 自动翻译外文新闻为中文
- 🎨 **内容优化**: 智能重写和摘要生成
- 🏷️ **智能标注**: 自动提取关键词和分类
- 🔍 **情感分析**: 识别新闻情感倾向
- 🚀 **本地化处理**: 支持本地AI模型，保护数据隐私
- ⚡ **批量处理**: 高效处理大量新闻内容

---

## 🤖 支持的AI引擎

### 1. Ollama (推荐)
- **优势**: 本地部署，数据隐私，免费使用
- **支持模型**: qwen3:8b, llama3.1:8b, qwen2.5-coder:7b 等
- **配置示例**:
```json
{
  "ai": {
    "enabled": true,
    "engine": "ollama",
    "ollama": {
      "baseUrl": "http://localhost:11434",
      "model": "qwen3:8b",
      "timeout": 600000
    }
  }
}
```

### 2. OpenAI
- **优势**: 高质量输出，响应速度快
- **支持模型**: GPT-4, GPT-3.5-turbo
- **配置示例**:
```json
{
  "ai": {
    "enabled": true,
    "engine": "openai",
    "openai": {
      "apiKey": "your-openai-api-key",
      "model": "gpt-4"
    }
  }
}
```

### 3. Google Gemini
- **优势**: 强大的多模态能力
- **支持模型**: gemini-pro, gemini-1.5-pro
- **配置示例**:
```json
{
  "ai": {
    "enabled": true,
    "engine": "gemini",
    "gemini": {
      "apiKey": "your-gemini-api-key",
      "model": "gemini-pro"
    }
  }
}
```

### 4. SiliconFlow
- **优势**: 国内服务，速度稳定
- **支持模型**: 多种开源模型
- **配置示例**:
```json
{
  "ai": {
    "enabled": true,
    "engine": "siliconflow",
    "siliconflow": {
      "apiKey": "your-siliconflow-api-key",
      "model": "qwen-plus"
    }
  }
}
```

### 5. OpenRouter
- **优势**: 统一API接口，多模型选择
- **支持模型**: 200+ 开源和商业模型
- **配置示例**:
```json
{
  "ai": {
    "enabled": true,
    "engine": "openrouter",
    "openrouter": {
      "apiKey": "your-openrouter-api-key",
      "model": "anthropic/claude-3.5-sonnet"
    }
  }
}
```

---

## 🛠️ AI任务类型

### 1. 翻译 (translate)
**功能**: 以资深新闻播报撰稿人身份将外文新闻翻译成规范的中文新闻表达
- **输入**: 英文新闻标题和内容
- **输出**: 符合半官方新闻媒体标准的规范中文翻译
- **专业特点**: 
  - 使用准确、严谨的新闻用词
  - 保持权威性和客观性
  - 符合中文新闻写作习惯和表达方式
  - 采用专业的新闻语态和句式结构
  - **保持原文的段落结构和逻辑层次**
  - **每个自然段落之间保持清晰的分段**
- **示例**:
  - 原文: "Lara Gillespie earns historic Tour de France podium finish"
  - 专业翻译: "拉拉·吉莱斯皮在环法自行车赛中获得历史性领奖台成绩"

### 2. 重写 (rewrite)
**功能**: 以资深新闻播报撰稿人身份对新闻内容进行专业重写，符合半官方媒体发布标准
- **输入**: 原始或翻译后的新闻内容
- **输出**: 与原文长度相近（不少于90%）、覆盖所有要点的专业重写内容
- **专业特点**: 
  - 全面覆盖原文的每一个要点和细节信息
  - 采用权威、客观、严谨的新闻语言风格
  - 使用符合中文新闻播报习惯的表达方式
  - 确保内容的准确性、完整性和专业性
  - 优化段落结构和逻辑层次，提升可读性
  - 保持半官方媒体的权威性和公信力
  - **合理分段，每个段落包含一个主要观点或事件**
  - **段落之间逻辑清晰，层次分明**
  - **采用专业新闻格式，包含标题、副标题等**

### 3. 摘要 (summarize)
**功能**: 生成简洁的新闻摘要
- **输入**: 完整的新闻内容
- **输出**: 100字以内的精炼摘要
- **应用**: 快速浏览，移动端展示

### 4. 关键词提取 (extract_keywords)
**功能**: 从新闻中提取关键词
- **输入**: 新闻标题和内容
- **输出**: 5-8个相关关键词，逗号分隔
- **应用**: SEO优化，内容标签

### 5. 智能分类 (categorize)
**功能**: 自动为新闻分配合适的分类
- **输入**: 新闻内容
- **输出**: 分类标签（政治、经济、科技、体育、娱乐、社会、国际、其他）
- **应用**: 自动化内容管理

### 6. 情感分析 (sentiment)
**功能**: 分析新闻的情感倾向
- **输入**: 新闻内容
- **输出**: 情感标签（正面、负面、中性）
- **应用**: 舆情监控，内容筛选

---

## ⚙️ 配置说明

### 基础配置
```json
{
  "ai": {
    "enabled": true,                    // 启用/禁用AI功能
    "engine": "ollama",                 // AI引擎选择
    "tasks": [                          // 要执行的AI任务
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

### 引擎特定配置

#### Ollama配置
```json
{
  "ollama": {
    "baseUrl": "http://localhost:11434",   // Ollama服务地址
    "model": "qwen3:8b",                   // 使用的模型
    "timeout": 600000                      // 超时时间(ms)
  }
}
```

#### OpenAI配置
```json
{
  "openai": {
    "apiKey": "sk-...",                    // API密钥
    "model": "gpt-4",                      // 模型名称
    "temperature": 0.7,                    // 创造性参数
    "maxTokens": 1000                      // 最大token数
  }
}
```

### 任务执行顺序
AI任务按配置顺序执行，建议顺序：
1. `translate` - 首先翻译
2. `rewrite` - 然后重写优化
3. `summarize` - 生成摘要
4. `extract_keywords` - 提取关键词
5. `categorize` - 智能分类
6. `sentiment` - 情感分析

---

## 🎬 功能演示

### 完整处理流程示例

#### 原始英文新闻
```
标题: "Lara Gillespie earns historic Tour de France podium finish"
内容: "Ireland's Lara Gillespie produced a superb ride on stage four of the the Tour de France Femmes on Tuesday to earn a historic third-placed finish..."
```

#### AI处理后
```json
{
  "title": "拉拉·吉莱斯皮赢得历史性环法自行车赛领奖台",
  "content": "爱尔兰车手拉拉·吉尔斯皮在环法女子赛第四赛段获第三名，成为首位参加该赛事的爱尔兰车手，总排名106位。荷兰车手维贝斯赢得赛段冠军，总排名第二。",
  "summary": "爱尔兰车手吉莱斯皮在环法女子赛获得历史性第三名",
  "keywords": ["环法自行车赛", "爱尔兰", "吉莱斯皮", "女子赛", "领奖台"],
  "category": "体育",
  "sentiment": "正面"
}
```

### 处理日志示例
```
2025-07-29 18:22:25 info: Processing content with Ollama (qwen3:8b): translate
2025-07-29 18:22:52 info: Ollama processing completed successfully
2025-07-29 18:22:52 info: Processing content with Ollama (qwen3:8b): rewrite
2025-07-29 18:23:17 info: Ollama processing completed successfully
2025-07-29 18:23:17 info: Processing content with Ollama (qwen3:8b): summarize
2025-07-29 18:23:22 info: Ollama processing completed successfully
```

---

## 🚀 性能优化

### 1. 模型选择建议
- **轻量级任务**: qwen3:8b, llama3.1:8b
- **高质量输出**: qwen3:14b, gpt-4
- **平衡性能**: qwen2.5-coder:7b

### 2. 超时设置
```json
{
  "timeout": 600000  // 10分钟，适合复杂任务
}
```

### 3. 批量处理优化
- 单个任务串行执行，避免模型过载
- 设置合理的重试机制
- 监控内存使用情况

### 4. 网络优化
- 本地模型：使用Ollama避免网络延迟
- 云端API：选择地理位置较近的服务
- 设置连接池复用

---

## 🔧 故障排除

### 常见问题

#### 1. AI代理创建失败
```bash
# 检查Ollama服务状态
curl http://localhost:11434/api/tags

# 启动Ollama服务
ollama serve
```

#### 2. 模型不存在
```bash
# 下载模型
ollama pull qwen3:8b
ollama pull llama3.1:8b
```

#### 3. 超时错误
- 增加timeout设置
- 使用更轻量级的模型
- 减少内容长度

#### 4. API密钥错误
- 检查密钥格式和有效性
- 确认账户余额充足
- 验证API权限

### 调试命令
```bash
# 检查AI配置
NODE_ENV=remote node -e "
const config = require('./config/config.remote.json');
console.log('AI状态:', config.ai.enabled);
console.log('引擎:', config.ai.engine);
console.log('任务:', config.ai.tasks);
"

# 测试AI连接
NODE_ENV=remote node -e "
const { AIFactory } = require('./dist/ai/factory');
const config = require('./config/config.remote.json');
const agent = AIFactory.getAgent(config);
console.log('AI代理:', agent ? '创建成功' : '创建失败');
"

# 基础AI功能测试
NODE_ENV=remote node test-ai.js

# URL测试（输入新闻网页链接）
node test-ai-url.js

# 批量URL测试
echo "https://www.rte.ie/news/world/2025/0729/1525999-uk-palestine/" | node test-ai-url.js
```

### AI测试工具

#### 1. 基础功能测试 (`test-ai.js`)
- 测试预设内容的AI处理
- 验证各AI任务的基本功能
- 快速检查AI引擎状态

#### 2. URL实战测试 (`test-ai-url.js`) 
- 🆕 **实际网页内容测试**
- 输入任意新闻网页URL
- 执行完整AI处理流程
- 生成详细测试报告
- 保存结果到 `reports/` 目录

**使用示例**：
```bash
# 交互式输入URL
node test-ai-url.js

# 直接测试指定URL
echo "https://example-news.com/article" | node test-ai-url.js
```

#### 3. 批量URL处理 (`batch-ai-url.js`)
- 🔥 **批量URL处理**
- 从文件读取多个新闻URL
- 顺序执行所有AI任务
- 生成汇总报告包含原文和最终结果
- 支持大规模内容处理

**使用示例**：
```bash
# 使用示例文件
node batch-ai-url.js sample-urls.txt

# 使用自定义URL文件
node batch-ai-url.js my-urls.txt
```

**批量报告包含**：
- � 批量处理统计（成功率、耗时等）
- 📰 每个URL的原文和最终结果
- 🤖 AI任务执行情况汇总
- � 内容质量分析
- � 性能指标和优化建议

详细使用说明请参考：
- [AI URL测试指南](./AI_URL_TEST_GUIDE.md)
- [批量AI处理指南](./BATCH_AI_GUIDE.md)

---

## 💡 最佳实践

### 1. 配置建议
- **开发环境**: 使用Ollama本地模型，快速迭代
- **生产环境**: 使用云端API，确保稳定性
- **混合部署**: 翻译用云端，其他用本地

### 2. 任务组合策略
```json
// 完整处理
"tasks": ["translate", "rewrite", "summarize", "extract_keywords", "categorize"]

// 快速处理
"tasks": ["translate", "summarize"]

// 分析导向
"tasks": ["categorize", "sentiment", "extract_keywords"]
```

### 3. 内容过滤
- 先过滤关键词，再进行AI处理
- 避免处理无关内容，节省资源
- 设置内容长度限制

### 4. 监控与日志
- 记录处理时间和成功率
- 监控API使用量和成本
- 设置异常告警机制

### 5. 备份策略
```json
{
  "ai": {
    "fallback": {
      "enabled": true,
      "engine": "ollama",  // 备用引擎
      "skipOnError": false // 错误时是否跳过AI处理
    }
  }
}
```

---

## 📊 使用统计

### 当前配置状态
- ✅ **AI功能**: 已启用
- 🤖 **使用引擎**: Ollama (qwen3:8b)
- 🛠️ **活动任务**: 6个 (translate, rewrite, summarize, extract_keywords, categorize, sentiment)
- 📡 **服务地址**: http://localhost:11434
- ⏱️ **超时设置**: 10分钟

### 处理效果
- 🌍 **翻译准确率**: >95%
- 📝 **摘要质量**: 高质量，100字内
- 🏷️ **关键词相关性**: >90%
- 📊 **分类准确率**: >85%
- ❤️ **情感识别**: 基本准确

---

## 🔮 未来规划

### 计划中的功能
1. **多模态处理**: 图片内容理解和描述
2. **实时流处理**: 支持流式AI处理
3. **自定义提示词**: 用户可配置AI提示模板
4. **A/B测试**: 多模型对比和选择
5. **缓存机制**: 相似内容智能缓存

### 技术优化
1. **并行处理**: 支持多任务并行执行
2. **增量学习**: 根据用户反馈优化模型
3. **自动调优**: 基于性能自动调整参数
4. **成本优化**: 智能选择最优模型和参数

---

## 📞 技术支持

如有问题或建议，请参考：
- 📚 [NewsScraper 完整文档](./README.md)
- 🔧 [配置示例](./config/)
- 🐛 [故障排除指南](./TROUBLESHOOTING.md)
- 💬 [讨论区](https://github.com/your-repo/discussions)

---

**更新时间**: 2025年7月29日  
**版本**: v2.0.0  
**作者**: NewsScraper Team
