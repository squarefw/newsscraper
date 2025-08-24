# AI处理工具模块使用指南

## 概述
AI处理工具模块提供了统一的AI任务处理功能，可被多个脚本复用，避免代码重复。

## 文件结构
```
utils/aiProcessor.js        # JavaScript版本（主要版本，功能完整）
config/category-mapping.json # 自定义API分类映射配置
tools/test-ai-processor.js  # 测试脚本
```

## 主要功能

### 1. AI任务处理
```javascript
const { processNewsWithAI } = require('../utils/aiProcessor');

const result = await processNewsWithAI(
  aiAgent,           // AI代理对象
  originalContent,   // 原始内容 {title, content}
  tasks,            // 任务列表 ['translate', 'rewrite', ...]
  wpCategories,     // WordPress分类列表（可选）
  config            // 配置对象（可选）
);
```

### 2. 内容增强
```javascript
const { enhanceContent } = require('../utils/aiProcessor');

const enhanced = enhanceContent(
  content,      // 原始内容
  originalUrl,  // 来源URL
  title,        // 标题
  config        // 配置对象
);
```

### 3. 分类处理
```javascript
const { getCategoryId } = require('../utils/aiProcessor');

// 无映射配置（返回标准化分类名）
const categoryId = getCategoryId('科技');  // -> 'ke-ji'

// 有映射配置（返回对应UUID）
const mapping = { '科技': 'uuid-123', '政治': 'uuid-456' };
const categoryId = getCategoryId('科技', mapping, 'default-uuid');  // -> 'uuid-123'
```

### 4. 关键词解析
```javascript
const { parseKeywords } = require('../utils/aiProcessor');

const keywords = parseKeywords('科技,人工智能,机器学习');
// -> ['科技', '人工智能', '机器学习']
```

### 5. WordPress分类约束
```javascript
const { generateCategoryPrompt, validateAndGetCategoryId } = require('../utils/aiProcessor');

// 生成分类提示词
const prompt = generateCategoryPrompt(content, wpCategories);

// 验证AI选择的分类
const categoryId = await validateAndGetCategoryId(
  aiSelectedCategory,
  wpCategories,
  fallbackCategory
);
```

## 配置说明

### 自定义API分类映射
在 \`config/category-mapping.json\` 中配置：
```json
{
  "customApiCategoryMapping": {
    "科技": "4c19e28c-6eec-4fe2-8ecd-079620093426",
    "政治": "cfcd49aa-bf03-4b18-8deb-a48ba92ff97a"
  },
  "defaultCategoryId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 配置文件中的分类映射
```json
{
  "api": {
    "categoryMapping": {
      "科技": "custom-tech-id",
      "政治": "custom-politics-id"
    },
    "defaultCategoryId": "custom-default-id"
  }
}
```

## 改进优势

### 1. 消除硬编码
- ❌ 之前：硬编码UUID在函数中
- ✅ 现在：支持配置文件和动态映射

### 2. 提高灵活性
- 支持自定义分类映射
- 支持回退到标准化分类名
- 支持不同环境的不同配置

### 3. 代码复用
- 所有脚本共享同一套AI处理逻辑
- 统一的错误处理和日志记录
- 一致的API接口

### 4. 易于维护
- 修改一处，所有地方生效
- 集中的配置管理
- 完整的测试覆盖

## 使用示例

### 在新脚本中使用
```javascript
const { 
  processNewsWithAI,
  enhanceContent,
  parseKeywords 
} = require('../utils/aiProcessor');

// 处理新闻内容
const processedData = await processNewsWithAI(
  aiAgent,
  { title: '新闻标题', content: '新闻内容' },
  ['translate', 'categorize'],
  wpCategories,
  config
);

// 增强内容
const enhancedContent = enhanceContent(
  processedData.finalContent,
  'https://example.com/news',
  processedData.finalTitle,
  config
);

// 解析关键词
const keywords = parseKeywords(processedData.keywords);
```

### 测试工具模块
```bash
node tools/test-ai-processor.js
```

## 注意事项

1. **配置优先级**：
   - 配置对象中的映射 > 默认映射文件 > 标准化分类名

2. **错误处理**：
   - 映射文件加载失败时会给出警告但不会中断执行
   - 分类匹配失败时会使用默认分类

3. **兼容性**：
   - 现有脚本无需修改即可使用新功能
   - 向后兼容旧的硬编码方式
