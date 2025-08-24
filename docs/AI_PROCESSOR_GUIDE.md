# AI处理工具模块

## 概述

`aiProcessor` 模块提供了统一的AI任务处理功能，将AI处理逻辑从各个脚本中提取出来，实现代码复用和维护性提升。

## 模块文件

- **JavaScript版本**: `utils/aiProcessor.js` - 供工具脚本直接使用，功能完整且支持动态分类

## 主要功能

### 1. 核心AI处理函数

#### `processNewsWithAI(aiAgent, originalContent, tasks, wpCategories, config)`
执行完整的AI任务序列，包含：
- **标题优化**: 自动翻译/重写标题，限制在25字符内
- **内容处理**: 执行配置的AI任务（翻译、重写、摘要等）
- **分类约束**: 支持WordPress分类约束
- **错误处理**: 完善的异常处理和回退机制

**参数:**
- `aiAgent`: AI代理实例
- `originalContent`: 原始内容 `{title: string, content: string}`
- `tasks`: AI任务列表 `['translate', 'rewrite', 'categorize', ...]`
- `wpCategories`: WordPress分类列表（可选）
- `config`: 配置对象（可选）

**返回值:**
```javascript
{
  originalTitle: string,
  originalContent: string,
  finalTitle: string,
  finalContent: string,
  keywords: string,
  category: string,
  sentiment: string,
  summary: string,
  results: AITaskResult[]
}
```

### 2. 分类处理函数

#### `generateCategoryPrompt(content, categories)`
生成AI分类约束提示词，确保AI只从现有WordPress分类中选择。

#### `validateAndGetCategoryId(aiSelectedCategory, categories, fallbackCategory)`
验证AI选择的分类是否存在，支持精确匹配和模糊匹配。

### 3. 内容增强函数

#### `enhanceContent(content, originalUrl, title, config)`
增强文章内容，支持：
- 添加来源链接
- 添加发布时间
- 自定义模板

### 4. 工具函数

#### `parseKeywords(keywordsString)`
解析关键词字符串为数组，支持多种分隔符。

#### `getCategoryId(categoryName)`
根据分类名称获取自定义API的分类ID。

#### `getTaskName(task)`
获取AI任务的中文名称。

## 使用示例

### 在工具脚本中使用

```javascript
const { 
  processNewsWithAI,
  enhanceContent,
  parseKeywords
} = require('../utils/aiProcessor');

// 执行AI处理
const aiResult = await processNewsWithAI(
  aiAgent, 
  { title: '标题', content: '内容' },
  ['translate', 'categorize'],
  wpCategories,
  config
);

// 增强内容
const enhanced = enhanceContent(
  aiResult.finalContent,
  originalUrl,
  aiResult.finalTitle,
  config
);
```

### 在TypeScript项目中使用

```typescript
import { 
  processNewsWithAI,
  enhanceContent,
  AIProcessResult 
} from './aiProcessor';

const result: AIProcessResult = await processNewsWithAI(
  aiAgent,
  originalContent,
  tasks,
  wpCategories,
  config
);
```

## 配置选项

```javascript
const config = {
  wordpress: {
    categoryConstraints: {
      enabled: true,
      fallbackCategory: '未分类',
      cacheDuration: 3600000  // 1小时
    },
    contentEnhancement: {
      addSourceLink: true,
      sourceLinkTemplate: '\n\n---\n**来源链接**: [{title}]({url})',
      addPublishDate: true,
      publishDateTemplate: '\n\n*发布时间: {date}*'
    }
  }
};
```

## 支持的AI任务

- `translate`: 翻译
- `rewrite`: 重写
- `summarize`: 摘要
- `extract_keywords`: 关键词提取
- `categorize`: 智能分类
- `sentiment`: 情感分析

## 标题优化特性

### 自动标题处理
- 英文标题自动翻译为中文
- 标题长度限制在25字符内
- 支持标题重写优化
- 异常情况自动回退到原标题

### 处理逻辑
1. 检测标题是否包含英文字符
2. 英文标题 → 翻译为中文
3. 中文标题或翻译失败 → 基于内容重写
4. 长度验证（≤35字符）
5. 失败时保持原标题

## 错误处理

- 每个AI任务独立处理，单个失败不影响其他任务
- 提供详细的错误信息和执行时间统计
- 支持部分成功的结果处理
- 自动回退机制确保稳定性

## 迁移指南

### 从现有脚本迁移

1. **导入AI工具模块**:
   ```javascript
   const { processNewsWithAI, enhanceContent } = require('../utils/aiProcessor');
   ```

2. **删除重复的函数定义**:
   - `getTaskName`
   - `generateCategoryPrompt`
   - `validateAndGetCategoryId`
   - `enhanceContent`
   - `processNewsWithAI`
   - `parseKeywords`
   - `getCategoryId`

3. **更新函数调用**:
   直接使用导入的函数，参数保持不变。

### 现有脚本支持

已更新的脚本：
- ✅ `tools/batch-ai-push-enhanced.js`

计划更新：
- 🔄 `tools/test-ai.js`
- 🔄 `tools/test-ai-url.js`
- 🔄 其他AI相关工具脚本

## 优势

1. **代码复用**: 消除重复代码，统一AI处理逻辑
2. **维护性**: 集中管理AI功能，便于更新和修复
3. **一致性**: 所有脚本使用相同的AI处理流程
4. **扩展性**: 易于添加新的AI任务和功能
5. **类型安全**: TypeScript版本提供完整的类型定义
6. **错误处理**: 统一的错误处理和日志记录

## 更新日志

- **v1.0.0**: 初始版本，支持标题优化和分类约束
- **特性**: 标题长度控制、WordPress分类约束、内容增强
