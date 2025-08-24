# WordPress 集成指南

本项目现在支持将抓取的新闻文章自动推送到 WordPress 网站。您可以同时推送到自定义 API 和 WordPress，或者仅推送到其中一个。

## 功能特性

- ✅ 自动推送文章到 WordPress
- ✅ 自动创建和管理分类
- ✅ 自动创建和管理标签  
- ✅ 自动上传特色图片
- ✅ 支持自定义文章状态（草稿/发布/私有）
- ✅ 支持批量标签处理
- ✅ 连接测试和错误处理
- ✅ 与现有 API 并行推送

## 快速开始

### 1. 准备 WordPress 站点

#### 1.1 确保 REST API 启用
WordPress REST API 默认是启用的，但请确保您的站点可以访问：
```
https://your-site.com/wp-json/wp/v2/posts
```

#### 1.2 创建应用密码
1. 登录 WordPress 后台
2. 进入 "用户" → "个人资料"
3. 滚动到底部找到 "应用密码" 部分
4. 创建新的应用密码，名称如 "News Scraper"
5. 保存生成的密码（格式：xxxx xxxx xxxx xxxx）

### 2. 配置项目

#### 2.1 更新配置文件
编辑您的配置文件（如 `config/config.development.json`）：

```json
{
  "api": {
    "baseUrl": "http://localhost:3000/api",
    "apiKey": "your-existing-api-key"
  },
  "wordpress": {
    "enabled": true,
    "baseUrl": "https://your-wordpress-site.com",
    "username": "your-wp-username",
    "password": "xxxx xxxx xxxx xxxx",
    "defaultStatus": "draft",
    "defaultCategory": "新闻"
  },
  "ai": {
    // ... 现有 AI 配置
  }
}
```

#### 2.2 配置选项说明

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `enabled` | 是否启用 WordPress 推送 | `false` |
| `baseUrl` | WordPress 站点 URL | 必填 |
| `username` | WordPress 用户名 | 必填 |
| `password` | WordPress 应用密码 | 必填 |
| `defaultStatus` | 默认文章状态 | `draft` |
| `defaultCategory` | 默认分类名称 | 可选 |

#### 2.3 文章状态选项
- `draft` - 草稿（推荐用于测试）
- `publish` - 立即发布
- `private` - 私有文章

### 3. 测试配置

#### 3.1 编译项目
```bash
npm run build
```

#### 3.2 运行 WordPress 测试工具
```bash
# 使用配置文件中的设置
node tools/test-wordpress.js

# 或使用环境变量
WP_BASE_URL=https://mysite.com WP_USERNAME=admin WP_PASSWORD="xxxx xxxx xxxx xxxx" node tools/test-wordpress.js
```

测试工具会检查：
- WordPress 连接
- 分类获取和创建
- 标签获取和创建
- 测试文章发布

### 4. 运行新闻抓取

启用 WordPress 后，系统会：
1. 抓取新闻文章
2. 应用 AI 处理（如果启用）
3. 同时推送到自定义 API 和 WordPress
4. 记录推送结果

```bash
npm start
```

## 高级配置

### 自定义分类映射

如果需要将不同类型的新闻映射到不同的 WordPress 分类，可以在代码中自定义：

```typescript
// 在 wordpressService.ts 中自定义分类逻辑
const getCategoryForArticle = (article: NewsArticle): string => {
  if (article.tags?.includes('体育')) return '体育新闻';
  if (article.tags?.includes('科技')) return '科技资讯';
  return '一般新闻';
};
```

### 图片处理优化

系统会自动：
1. 从抓取的文章中提取特色图片
2. 下载图片到 WordPress 媒体库
3. 设置为文章特色图片

### 错误处理

- WordPress 推送失败不会影响主 API 推送
- 所有错误都会记录到日志中
- 支持重试机制（可配置）

## 常见问题

### Q: 如何获取 WordPress 应用密码？
A: 进入 WordPress 后台 → 用户 → 个人资料 → 应用密码，创建新密码。

### Q: 推送失败怎么办？
A: 检查：
1. WordPress 站点 URL 是否正确
2. 用户名和应用密码是否正确
3. WordPress REST API 是否启用
4. 网络连接是否正常

### Q: 可以只推送到 WordPress 吗？
A: 是的，将 `wordpress.enabled` 设为 `true`，并在代码中注释掉自定义 API 推送部分。

### Q: 如何自定义文章格式？
A: 修改 `wordpressService.ts` 中的 `pushToWordPress` 函数。

### Q: 支持自定义字段吗？
A: 是的，可以在 `WordPressArticle` 接口中添加 `meta` 字段。

## 文件结构

```
src/
├── wordpressClient.ts      # WordPress API 客户端
├── wordpressService.ts     # WordPress 推送服务
├── scraper.ts             # 修改后的抓取器（支持 WordPress）
└── main.ts                # 修改后的主程序（支持 WordPress）

config/
├── config.wordpress.example.json  # WordPress 配置示例
└── config.development.json        # 开发配置（已添加 WordPress）

tools/
└── test-wordpress.js      # WordPress 测试工具
```

## API 参考

### WordPressClient 类

主要方法：
- `pushArticle(article)` - 推送文章
- `getCategories()` - 获取分类列表
- `createCategory(name)` - 创建新分类
- `findOrCreateCategory(name)` - 查找或创建分类
- `processTagsArray(tags)` - 批量处理标签
- `uploadMediaFromUrl(url)` - 从 URL 上传媒体
- `testConnection()` - 测试连接

### 配置接口

```typescript
interface WordPressConfig {
  enabled: boolean;
  baseUrl: string;
  username: string;
  password: string;
  defaultStatus?: 'publish' | 'draft' | 'private';
  defaultCategory?: string;
}
```

## 贡献和支持

如果遇到问题或需要新功能，请：
1. 查看日志文件 `logs/error.log`
2. 运行测试工具进行诊断
3. 提交 Issue 或 Pull Request

## 许可证

与主项目相同的许可证。
