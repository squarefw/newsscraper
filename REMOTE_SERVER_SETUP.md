# 远程服务器 192.168.1.230:8080 配置完成

## ✅ 服务器状态检查

- **服务器地址**: 192.168.1.230:8080
- **用户名**: squarefw@gmail.com  
- **密码**: chicken
- **连通性**: ✅ 正常
- **WordPress REST API**: ✅ 已启用 (104个端点可用)

## 📁 已生成的文件

1. **配置文件**: `config/config.remote-230.json`
2. **配置助手**: `tools/setup/setup-remote-wordpress.js`  
3. **专用测试工具**: `tools/test/test-remote-wordpress.js`

## 🔧 下一步操作

### 步骤 1: 获取 WordPress 应用密码

1. 访问 WordPress 后台：http://192.168.1.230:8080/wp-admin
2. 使用您的登录凭据登录
3. 进入 **"用户" → "个人资料"**
4. 滚动到页面底部找到 **"应用密码"** 部分
5. 在 "新应用密码名称" 输入：`News Scraper`
6. 点击 **"添加新的应用密码"**
7. **复制生成的密码**（格式：`xxxx xxxx xxxx xxxx`）

### 步骤 2: 更新配置文件

编辑 `config/config.remote-230.json`，找到这一行：
```json
"password": "YOUR_WORDPRESS_PASSWORD"
```

替换为您刚才复制的应用密码：
```json
"password": "YOUR_PASSWORD"
```

### 步骤 3: 测试连接

```bash
# 编译项目
npm run build

# 测试远程连接
node tools/test-remote-wordpress.js
```

### 步骤 4: 启动新闻抓取

```bash
# 使用远程配置启动
NODE_ENV=remote-230 npm start
```

## 🎯 配置概览

您的配置文件 (`config/config.remote-230.json`) 包含：

- **自定义API**: 本地开发API (localhost:3000)
- **WordPress**: 远程服务器 (192.168.1.230:8080)
- **AI引擎**: Ollama (本地) + OpenRouter (云端)
- **文章状态**: 草稿模式（安全测试）
- **默认分类**: "新闻"

## 🔍 验证清单

- [x] 远程服务器可访问
- [x] WordPress REST API 可用  
- [x] 配置文件已生成
- [x] 测试工具已准备
- [ ] WordPress 应用密码已配置 ⬅️ **您需要完成这一步**
- [ ] 连接测试通过
- [ ] 新闻抓取测试

## 🚀 完整工作流程

1. **配置应用密码** ← 当前步骤
2. **测试连接**: `node tools/test-remote-wordpress.js`
3. **运行抓取**: `NODE_ENV=remote-230 npm start`
4. **查看结果**: 检查 WordPress 后台的文章

## 💡 提示

- 首次运行建议保持 `"defaultStatus": "draft"` 以便检查结果
- 测试成功后可改为 `"defaultStatus": "publish"` 自动发布
- 所有推送日志会记录在 `logs/` 目录中

## 📞 如需帮助

如果遇到问题，请运行：
```bash
node tools/validate-wordpress-simple.js  # 检查安装
node tools/test-remote-wordpress.js      # 测试连接
```

检查日志文件：`logs/error.log`
