# API密钥配置管理指南

## 概述

为了提高安全性和便于管理，所有API密钥已从配置文件中分离到独立的密钥文件中。这确保敏感信息不会意外上传到Git仓库。

## 文件结构

```
config/
├── api-keys.json                 # 密钥模板文件（已上传到Git）
├── api-keys.local.json          # 实际密钥文件（不上传Git）
├── config-loader.js             # 配置加载器
├── config.remote-230.json       # 生产配置（已移除密钥）
└── config.remote-aliyun.json    # 阿里云配置（已移除密钥）
```

## 快速设置

### 1. 复制密钥文件

```bash
# 复制模板文件
cp config/api-keys.json config/api-keys.local.json

# 编辑本地密钥文件，填入真实API密钥
nano config/api-keys.local.json
```

### 2. 配置API密钥

编辑 `config/api-keys.local.json`：

```json
{
  "wordpress": {
    "remote-230": {
      "username": "你的WordPress用户名",
      "password": "YOUR_PASSWORD"
    }
  },
  "ai": {
    "openai": {
      "apiKey": "YOUR_API_KEY"
    },
    "gemini": {
      "apiKey": "YOUR_API_KEY"
    },
    "siliconflow": {
      "apiKey": "YOUR_API_KEY"
    }
    // ... 其他AI引擎密钥
  }
}
```

## 配置文件变更

### 主要变更

1. **API密钥移除**: 所有配置文件中的真实API密钥已替换为 `"FROM_API_KEYS_CONFIG"`
2. **自动注入**: 配置加载器会自动从密钥文件中读取并注入真实密钥
3. **Git安全**: 密钥文件已添加到 `.gitignore`，不会上传到仓库

### 环境支持

配置加载器支持多环境：
- `remote-230`: 192.168.1.230服务器环境
- `remote-aliyun`: 阿里云服务器环境
- `development`: 开发环境
- `production`: 生产环境

## 使用方法

### 脚本自动加载

所有生产脚本已更新，会自动使用配置加载器：

```bash
# 原有命令无需更改，会自动加载密钥
node tools/production/batch-ai-push-enhanced.js config/config.remote-230.json
```

### 手动加载配置

```javascript
const ConfigLoader = require('./config/config-loader');

const configLoader = new ConfigLoader();
const config = configLoader.loadConfig('config/config.remote-230.json', 'remote-230');
```

## 安全特性

### Git保护

`.gitignore` 已更新，以下文件不会上传：
- `config/api-keys.local.json`
- `config/api-keys.private.json`
- `config/*-keys.json`
- `config/*-secrets.json`

### 密钥验证

配置加载器会：
1. 优先使用 `api-keys.local.json`
2. 如果不存在，回退到 `api-keys.json`
3. 提供清晰的错误信息和使用指导

## 故障排除

### 常见问题

1. **"未找到API密钥配置文件"**
   ```bash
   # 解决方案：创建本地密钥文件
   cp config/api-keys.json config/api-keys.local.json
   ```

2. **"使用模板API密钥配置"**
   - 提示：编辑 `api-keys.local.json` 填入真实密钥

3. **密钥注入失败**
   - 检查密钥文件格式是否正确
   - 确保环境标识符匹配

### 测试配置

```bash
# 测试配置加载
node -e "
const ConfigLoader = require('./config/config-loader');
const loader = new ConfigLoader();
const config = loader.loadConfig('config/config.remote-230.json', 'remote-230');
console.log('WordPress用户:', config.wordpress.username);
console.log('Qwen密钥前5位:', config.ai.engines.qwen.apiKey.substring(0, 5));
"
```

## 备份建议

1. **备份密钥文件**:
   ```bash
   cp config/api-keys.local.json config/api-keys.backup.json
   ```

2. **定期更新密钥**: 建议定期轮换API密钥以提高安全性

3. **团队共享**: 通过安全渠道（如加密文件或密钥管理系统）与团队成员共享密钥

## 注意事项

⚠️ **重要提醒**：
- 永远不要在聊天或公开场合分享 `api-keys.local.json` 文件内容
- 定期检查 `.gitignore` 确保密钥文件不会意外提交
- 使用专用的API密钥，避免使用具有过高权限的主密钥

## 扩展功能

### 添加新环境

1. 在密钥文件中添加新环境配置
2. 配置加载器会自动识别环境标识符
3. 创建对应的主配置文件

### 自定义密钥路径

可以通过环境变量指定自定义密钥文件路径：
```bash
export API_KEYS_PATH="/path/to/your/keys.json"
```
