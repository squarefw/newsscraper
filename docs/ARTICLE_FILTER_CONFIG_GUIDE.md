# 文章筛选器配置指南

## 概述

文章筛选器现在支持独立的配置选项，您可以单独配置AI筛选功能，包括使用的AI引擎、筛选方法和各种参数。

## 配置位置

配置文件：`config/config.remote-230.json`

## AI任务配置

### 1. 添加专用的article_filter任务

```json
{
  "ai": {
    "taskEngines": {
      "article_filter": "gemini"  // 可选: gemini, siliconflow, openai, openrouter 等
    },
    "tasks": [
      "article_filter"  // 添加到任务列表
    ]
  }
}
```

### 2. 文章筛选器详细配置

```json
{
  "discovery": {
    "articleFilter": {
      "enabled": true,                    // 是否启用筛选
      "method": "rule-based",             // 筛选方法: "ai" 或 "rule-based"
      "maxLinksToAnalyze": 10,           // 最大分析链接数
      "confidenceThreshold": 5,          // 置信度阈值 (1-10)
      "aiEngine": "gemini",              // AI引擎 (仅在method为"ai"时使用)
      "ruleBasedSettings": {             // 规则筛选配置
        "scoreThreshold": 50,            // 评分阈值 (0-100)
        "urlPatternWeight": 30,          // URL模式权重
        "titleWeight": 15,               // 标题权重
        "contentWeight": 20,             // 内容权重
        "pathDepthWeight": 15            // 路径深度权重
      },
      "reporting": {                     // 报告配置
        "enabled": true,                 // 是否生成报告
        "reportPath": "examples/filter-report.txt"  // 报告保存路径
      }
    }
  }
}
```

## 配置选项详解

### 筛选方法 (method)

- **"ai"**: 使用AI进行智能分析，准确度高但消耗API额度
- **"rule-based"**: 使用规则引擎，速度快且不消耗API额度

### AI引擎选择 (aiEngine)

可选的AI引擎：
- **gemini**: Google Gemini (推荐用于文章筛选)
- **siliconflow**: SiliconFlow (速度快)
- **openai**: OpenAI GPT-4
- **openrouter**: OpenRouter (多模型)
- **github**: GitHub Models

### 规则筛选设置 (ruleBasedSettings)

- **scoreThreshold**: 评分阈值，超过此分数的链接被认为是新闻文章
- **urlPatternWeight**: URL模式分析权重，检测分类页面 vs 文章页面
- **titleWeight**: 标题分析权重，基于标题长度和内容
- **contentWeight**: 内容分析权重，基于页面内容丰富度
- **pathDepthWeight**: 路径深度权重，文章页面通常路径更深

## 使用示例

### 1. 使用AI筛选 (高准确度)

```json
{
  "discovery": {
    "articleFilter": {
      "enabled": true,
      "method": "ai",
      "aiEngine": "gemini",
      "confidenceThreshold": 7
    }
  }
}
```

### 2. 使用规则筛选 (高性能)

```json
{
  "discovery": {
    "articleFilter": {
      "enabled": true,
      "method": "rule-based",
      "ruleBasedSettings": {
        "scoreThreshold": 60,
        "urlPatternWeight": 35,
        "titleWeight": 20,
        "contentWeight": 25,
        "pathDepthWeight": 20
      }
    }
  }
}
```

### 3. 保守筛选 (保留更多链接)

```json
{
  "discovery": {
    "articleFilter": {
      "enabled": true,
      "method": "rule-based",
      "ruleBasedSettings": {
        "scoreThreshold": 30  // 降低阈值
      }
    }
  }
}
```

### 4. 严格筛选 (过滤更多链接)

```json
{
  "discovery": {
    "articleFilter": {
      "enabled": true,
      "method": "rule-based",
      "ruleBasedSettings": {
        "scoreThreshold": 70  // 提高阈值
      }
    }
  }
}
```

## 测试配置

使用测试脚本验证配置：

```bash
# 测试可配置筛选器
node tools/test-configurable-filter.js

# 测试规则筛选器
node tools/test-rule-based-filter.js
```

## 性能建议

1. **生产环境推荐**使用 `rule-based` 方法，92%准确度且无API成本
2. **高质量要求**可使用 `ai` 方法，但注意API额度限制
3. **混合策略**：先用规则筛选，对不确定的链接再用AI分析

## 监控和调优

1. 查看生成的报告文件了解筛选效果
2. 根据实际结果调整 `scoreThreshold` 和各权重参数
3. 监控API使用量(仅AI方法)
4. 定期检查筛选准确率

## 故障排除

### AI筛选失败
- 检查API密钥是否正确
- 确认AI引擎是否可用
- 查看错误日志定位问题

### 规则筛选效果不佳
- 调整 `scoreThreshold` 阈值
- 修改各权重参数
- 检查URL模式是否适合您的网站

### 配置不生效
- 确认JSON格式正确
- 重启应用程序
- 检查配置文件路径
