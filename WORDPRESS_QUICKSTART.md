# WordPress 集成快速启动指南

## 🚀 5分钟启动 WordPress 推送功能

### 步骤 1: 准备 WordPress 应用密码

1. 登录您的 WordPress 后台
2. 进入 **用户 → 个人资料**
3. 滚动到底部找到 **"应用密码"** 部分
4. 点击 **"添加新的应用密码"**
5. 输入名称：`News Scraper`
6. 点击 **"添加新的应用密码"**
7. **复制生成的密码**（格式类似：`xxxx xxxx xxxx xxxx`）

### 步骤 2: 配置项目

编辑 `config/config.development.json`，添加 WordPress 配置：

```json
{
  "api": {
    "baseUrl": "http://localhost:3000/api",
    "apiKey": "YOUR_API_KEY"
  },
  "wordpress": {
    "enabled": true,
    "baseUrl": "https://your-wordpress-site.com",
    "username": "your-wp-username", 
    "password": "YOUR_PASSWORD",
    "defaultStatus": "draft",
    "defaultCategory": "新闻"
  },
  "ai": {
    // ... 保持现有配置
  }
}
```

**重要提示：**
- `baseUrl`: 您的 WordPress 站点 URL（不要包含 `/wp-admin`）
- `username`: WordPress 用户名（不是邮箱地址）
- `password`: 刚才生成的应用密码（保持空格）
- `defaultStatus`: 建议先使用 `"draft"` 进行测试

### 步骤 3: 测试连接

```bash
# 编译项目
npm run build

# 测试 WordPress 连接
node tools/test/test-wordpress.js
```

如果看到 `✅ 连接成功！` 说明配置正确。

### 步骤 4: 运行新闻抓取

```bash
npm start
```

系统将：
1. 抓取新闻文章
2. 应用 AI 处理（如果启用）
3. **同时推送到自定义 API 和 WordPress**
4. 在 WordPress 后台查看草稿文章

### 步骤 5: 检查结果

1. 登录 WordPress 后台
2. 进入 **文章 → 所有文章**
3. 查看新创建的草稿文章
4. 检查分类和标签是否正确创建

## 🔧 常见问题排查

### 连接失败
```bash
❌ WordPress connection test failed
```

**解决方案：**
1. 检查 WordPress 站点 URL 是否正确
2. 确认用户名和应用密码正确
3. 确保 WordPress REST API 已启用
4. 测试 URL：`https://your-site.com/wp-json/wp/v2/posts`

### 认证失败
```bash
❌ WordPress API Error: 401 - Unauthorized
```

**解决方案：**
1. 重新生成应用密码
2. 确保用户名是 WordPress 用户名，不是邮箱
3. 检查用户是否有发布文章权限

### 推送成功但看不到文章
文章可能创建为草稿，请检查：
1. WordPress 后台 → 文章 → 所有文章
2. 筛选器选择 "草稿"
3. 或将 `defaultStatus` 改为 `"publish"`

## 🎯 下一步

1. **调整配置**：将 `defaultStatus` 改为 `"publish"` 自动发布
2. **自定义分类**：修改 `defaultCategory` 或在代码中添加智能分类逻辑
3. **增强功能**：查看 `docs/WORDPRESS_INTEGRATION.md` 了解高级配置

## 📞 需要帮助？

如果遇到问题：
1. 运行 `node tools/validate-wordpress-simple.js` 检查安装
2. 查看 `logs/error.log` 了解错误详情  
3. 参考 `docs/WORDPRESS_INTEGRATION.md` 完整文档
