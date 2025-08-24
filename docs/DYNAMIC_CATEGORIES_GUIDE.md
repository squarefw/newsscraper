# 动态分类获取功能使用指南

## 🎯 功能概述

动态分类获取功能允许系统在运行时从远程服务器获取最新的分类信息，而不是依赖本地硬编码的分类映射。这样可以：

- ✅ 支持多个不同的WordPress服务器
- ✅ 实时获取最新的分类信息
- ✅ 自动适应分类变化
- ✅ 提供智能缓存和备份机制

## 📁 文件结构

```
utils/remoteCategoryManager.js    # 远程分类管理器
utils/aiProcessor.js             # 更新后的AI处理工具
tools/test-dynamic-categories.js # 动态分类测试脚本
config/category-backup.json      # 自动生成的分类备份
```

## 🔧 工作流程

### 1. 分类获取过程
```
启动脚本 → 获取远程分类 → 缓存结果 → AI处理 → 推送内容
    ↓           ↓           ↓        ↓        ↓
  配置读取   API调用    内存存储   智能分类   多平台推送
```

### 2. 智能回退机制
```
远程API → 缓存 → 本地备份 → 默认分类
   ↓       ↓       ↓         ↓
 正常情况  网络慢   API故障   完全失败
```

## 📊 配置说明

### WordPress配置
```json
{
  "wordpress": {
    "enabled": true,
    "baseUrl": "http://192.168.1.230:8080",
    "username": "admin",
    "password": "your-password"
  }
}
```

### 自定义API配置
```json
{
  "api": {
    "enabled": true,
    "baseUrl": "https://your-api-server.com",
    "apiKey": "your-api-key"
  }
}
```

## 🚀 使用方法

### 1. 基本使用（批量处理脚本）
```bash
# 脚本会自动获取远程分类
node tools/batch-ai-push-enhanced.js config/config.remote-230.json urls.txt
```

### 2. 手动获取分类信息
```javascript
const { getAllCategories } = require('./utils/remoteCategoryManager');

const categoryInfo = await getAllCategories(config);
console.log('WordPress分类:', categoryInfo.wordpress);
console.log('自定义API分类:', categoryInfo.customApi);
```

### 3. 新脚本中使用
```javascript
const { processNewsWithDynamicCategories } = require('./utils/aiProcessor');

// 完整的AI处理流程，包括动态分类获取
const result = await processNewsWithDynamicCategories(
  aiAgent,
  { title: '新闻标题', content: '新闻内容' },
  ['translate', 'categorize'],
  config
);

// 结果包含分类信息
console.log('WordPress分类:', result.categoryInfo.wordpressCategories);
console.log('自定义API映射:', result.categoryInfo.customApiMapping);
```

## 📈 缓存机制

### 缓存策略
- **缓存时间**: 5分钟（可配置）
- **缓存键**: 基于服务器URL生成
- **自动刷新**: 过期后自动重新获取

### 缓存管理
```javascript
const { clearCategoryCache, getCacheStatus } = require('./utils/remoteCategoryManager');

// 查看缓存状态
const status = getCacheStatus();
console.log('缓存状态:', status);

// 清除缓存（强制重新获取）
clearCategoryCache();
```

## 🔍 API接口要求

### WordPress REST API
```http
GET /wp-json/wp/v2/categories
Authorization: Basic base64(username:password)
```

响应格式：
```json
[
  {
    "id": 1,
    "name": "科技",
    "slug": "tech",
    "description": "科技新闻",
    "count": 10
  }
]
```

### 自定义API
```http
GET /api/categories
Authorization: Bearer your-api-key
```

响应格式（支持多种）：
```json
// 格式1: 数组
[
  {
    "id": "uuid-123",
    "name": "科技",
    "slug": "tech",
    "nameEn": "technology"
  }
]

// 格式2: 对象映射
{
  "科技": "uuid-123",
  "politics": "uuid-456"
}
```

## 🛠️ 故障排除

### 常见问题

1. **网络连接失败**
   ```
   解决方案: 系统会自动使用缓存或本地备份
   ```

2. **认证失败**
   ```
   检查: username/password 或 apiKey 是否正确
   ```

3. **分类格式不匹配**
   ```
   确认: API响应格式符合要求
   ```

### 调试工具
```bash
# 测试分类获取功能
node tools/test-dynamic-categories.js

# 查看详细日志
DEBUG=category-manager node tools/batch-ai-push-enhanced.js
```

## 📊 性能优化

### 批量处理优化
- 分类信息在开始时获取一次
- 所有URL处理过程中复用分类信息
- 智能缓存减少重复请求

### 内存使用
- 分类信息存储在内存中
- 5分钟后自动过期释放
- 支持手动清除缓存

## 🔄 迁移指南

### 从硬编码分类迁移
1. **保留原有配置**作为备份
2. **更新配置文件**添加API端点
3. **测试连接性**确保API可访问
4. **验证分类映射**确保分类名称一致

### 配置多环境
```json
{
  "development": {
    "api": { "baseUrl": "http://localhost:3000" }
  },
  "production": {
    "api": { "baseUrl": "https://api.production.com" }
  }
}
```

## 💡 最佳实践

1. **定期备份分类映射**
   - 系统会自动创建备份
   - 建议定期检查备份文件

2. **监控API可用性**
   - 设置API健康检查
   - 关注错误日志

3. **合理设置缓存时间**
   - 开发环境: 短缓存时间
   - 生产环境: 适当延长缓存

4. **测试不同场景**
   - 网络正常时的表现
   - 网络中断时的回退机制
   - API变更时的适应性

这个动态分类获取功能让你的新闻抓取系统更加灵活和可靠！🎉
