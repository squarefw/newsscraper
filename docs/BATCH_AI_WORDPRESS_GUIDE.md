# WordPress 增强版 batch-ai-push 使用指南

## 🎯 新功能概览

基于现有的 `batch-ai-push.js`，我们成功添加了以下 WordPress 增强功能：

### ✅ 已实现的功能

1. **动态获取 WordPress 分类列表**
   - 自动从远程 WordPress API 获取所有分类
   - 分类信息缓存 1 小时，提高性能
   - 显示分类名称、描述和文章数量

2. **AI 分类约束机制**
   - AI 只能从实际存在的 WordPress 分类中选择
   - 智能匹配：精确匹配 → 模糊匹配 → 默认分类
   - 分类验证和ID映射

3. **内容增强功能**
   - 自动添加来源链接
   - 自动添加发布时间
   - 可自定义模板格式

4. **双平台推送**
   - 同时推送到自定义 API 和 WordPress
   - 独立的成功/失败统计
   - 容错机制：WordPress 失败不影响 API 推送

## 🚀 使用方法

### 步骤 1: 配置 WordPress 应用密码

1. 登录 WordPress 后台：http://192.168.1.230:8080/wp-admin
2. 进入 "用户" → "个人资料"
3. 创建应用密码：名称 "News Scraper"
4. 复制生成的密码

### 步骤 2: 更新配置文件

编辑 `config/config.remote-230.json`：

```json
{
  "wordpress": {
    "enabled": true,
    "baseUrl": "http://192.168.1.230:8080",
    "username": "squarefw@gmail.com",
    "password": "YOUR_API_PASSWORD",
    "defaultStatus": "draft",
    "categoryConstraints": {
      "enabled": true,
      "allowNewCategories": false,
      "fallbackCategory": "未分类"
    },
    "contentEnhancement": {
      "addSourceLink": true,
      "sourceLinkTemplate": "\\n\\n---\\n**来源链接**: [{title}]({url})",
      "addPublishDate": true
    }
  }
}
```

### 步骤 3: 准备 URL 文件

创建或编辑 URL 文件（如 `examples/wordpress-test-urls.txt`）：

```
# WordPress 增强版测试URL列表
https://www.bbc.com/news/technology-68934567
https://www.rte.ie/news/business/2025/0805/1567890-business-update/
```

### 步骤 4: 运行增强版脚本

```bash
# 使用远程配置运行增强版
NODE_ENV=remote-230 node tools/batch-ai-push-enhanced.js examples/wordpress-test-urls.txt
```

## 📊 功能对比

| 功能 | 原版 batch-ai-push.js | 增强版 batch-ai-push-enhanced.js |
|------|----------------------|----------------------------------|
| 自定义 API 推送 | ✅ | ✅ |
| WordPress 推送 | ❌ | ✅ |
| AI 处理 | ✅ | ✅ |
| 分类约束 | ❌ | ✅ 动态获取 WordPress 分类 |
| 来源链接 | ❌ | ✅ 自动添加 |
| 发布时间 | ❌ | ✅ 自动添加 |
| 双平台统计 | ❌ | ✅ 独立统计 |
| 配置灵活性 | 基础 | 高级 (多环境支持) |

## 🔧 配置选项详解

### WordPress 基础配置
```json
{
  "wordpress": {
    "enabled": true,              // 启用/禁用 WordPress 功能
    "baseUrl": "http://...",      // WordPress 站点 URL
    "username": "用户名",          // WordPress 用户名
    "password": "YOUR_PASSWORD",        // WordPress 应用密码
    "defaultStatus": "draft"      // 默认文章状态：draft/publish/private
  }
}
```

### 分类约束配置
```json
{
  "categoryConstraints": {
    "enabled": true,              // 启用分类约束
    "allowNewCategories": false,  // 是否允许创建新分类
    "fallbackCategory": "未分类", // 默认分类名称
    "cacheDuration": 3600000     // 分类缓存时间(毫秒)
  }
}
```

### 内容增强配置
```json
{
  "contentEnhancement": {
    "addSourceLink": true,        // 添加来源链接
    "sourceLinkTemplate": "模板", // 来源链接模板
    "addPublishDate": true,       // 添加发布时间
    "publishDateTemplate": "模板" // 发布时间模板
  }
}
```

## 📈 输出示例

运行时会看到类似输出：

```
🚀 NewsScraper 批量AI处理与推送脚本 (WordPress增强版)
===============================================================
新功能: ✅ WordPress分类约束 ✅ 来源链接 ✅ 智能分类
===============================================================

📋 使用配置: /path/to/config.remote-230.json
✅ WordPress 连接成功: http://192.168.1.230:8080
📂 获取到 5 个分类:
   - 科技 (12篇文章)
   - 新闻 (45篇文章)
   - 国际 (23篇文章)
   - 体育 (8篇文章)
   - 未分类 (3篇文章)

📝 准备处理 2 个URL，每个URL执行 6 个AI任务
📤 推送目标: 自定义API + WordPress
📂 分类约束: 启用 (5个可选分类)

📄 处理 1/2: https://www.bbc.com/news/technology-68934567
────────────────────────────────────────────────────────────
📡 正在访问: https://www.bbc.com/news/technology-68934567
   ✅ 提取成功 - 标题: 85字符, 正文: 1234字符
🤖 开始AI处理流程 (6个任务)
   5/6 执行 CATEGORIZE - 智能分类
     📂 使用WordPress分类约束 (5个可选分类)
     ✅ 完成 (2341ms) - 输出: 4字符
     📂 分类验证: "科技" -> ID: 123
📤 准备推送到自定义API: 处理后的新闻标题
   ✅ 自定义API推送成功 - 响应ID: abc123
📤 准备推送到 WordPress: 处理后的新闻标题
   ✅ WordPress 推送成功 - ID: 456, URL: http://192.168.1.230:8080/2025/08/05/news-title/
✅ URL处理完成 (15234ms) - API:✅ WP:✅

===============================================================================
🎉 批量处理与推送完成！
===============================================================================
📊 自定义API推送统计:
   ✅ 推送成功: 2/2 (100.0%)
📊 WordPress推送统计:
   ✅ 推送成功: 2/2 (100.0%)
📊 AI任务统计:
   ✅ 成功: 12/12 (100.0%)

📰 成功推送到WordPress的文章:
   1. 处理后的新闻标题1 (ID: 456)
      URL: http://192.168.1.230:8080/2025/08/05/news-title-1/
   2. 处理后的新闻标题2 (ID: 457)
      URL: http://192.168.1.230:8080/2025/08/05/news-title-2/

💡 提示:
   - WordPress文章以草稿状态创建，请登录后台查看并发布
   - WordPress后台: http://192.168.1.230:8080/wp-admin
   - 使用了WordPress分类约束，AI只能从5个现有分类中选择
```

## 🚧 故障排查

### WordPress 连接失败
```
❌ WordPress 连接失败
```
**解决方案**：
1. 检查服务器是否可访问
2. 确认应用密码正确
3. 检查用户权限

### 分类约束不生效
```
⚠️ AI选择的分类"未知分类"不存在，使用默认分类"未分类"
```
**说明**：这是正常的回滚机制，AI 会自动使用默认分类。

### 推送部分失败
- 自定义 API 失败不影响 WordPress 推送
- WordPress 失败不影响自定义 API 推送
- 每个平台都有独立的成功/失败统计

## 🎯 下一步

1. **测试功能**：使用测试 URL 验证所有功能
2. **调整配置**：根据需要修改分类约束和内容增强设置
3. **批量处理**：准备真实的新闻 URL 列表进行批量处理
4. **监控结果**：检查 WordPress 后台的文章创建情况

## 📞 技术支持

如遇到问题：
1. 查看详细的控制台输出
2. 检查 `logs/error.log` 文件
3. 运行单独的 WordPress 测试：`node tools/test-remote-wordpress.js`
