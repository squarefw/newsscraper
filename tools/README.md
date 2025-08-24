# Tools Directory

新闻抓取器工具集，已按功能分类整理。

## 📁 目录结构

```
tools/
├── README.md           # 本文档
├── production/         # 🚀 生产环境工具
├── setup/             # ⚙️ 配置和设置工具
└── test/              # 🧪 测试和验证工具
```

## 🚀 production/ - 生产环境工具

核心业务脚本，用于实际的新闻处理和推送。

| 文件 | 功能 | 用法 |
|------|------|------|
| `batch-ai-push-enhanced.js` | 增强版批量AI处理和推送 | `node production/batch-ai-push-enhanced.js config.json urls.txt` |
| `batch-ai-push.js` | 基础批量AI处理脚本 | `node production/batch-ai-push.js urls.txt` |
| `category-manager.js` | 分类管理工具 | `node production/category-manager.js` |
| `run-remote.sh` | 远程执行脚本 | `./production/run-remote.sh` |

## ⚙️ setup/ - 配置和设置工具

环境配置、权限管理和初始化工具。

| 文件 | 功能 | 用途 |
|------|------|------|
| `setup-remote-wordpress.js` | WordPress远程配置 | 配置WordPress站点 |
| `create-app-password.js` | 创建应用密码 | WordPress认证设置 |
| `check-user-permissions.js` | 检查用户权限 | 权限验证 |
| `fix-user-permissions.js` | 修复权限问题 | 权限故障修复 |
| `basic-auth-troubleshoot.js` | 认证故障排除 | 解决认证问题 |
| `wordpress-app-password-guide.js` | WordPress密码指南 | 操作指导 |

## 🧪 test/ - 测试和验证工具

开发测试、功能验证和故障诊断工具。

### AI 功能测试
- `test-ai-engines.js` - AI引擎功能测试
- `test-ai-processor.js` - AI处理器测试  
- `test-unified-prompts.js` - 统一prompt系统测试
- `test-dynamic-categories.js` - 动态分类测试

### WordPress 集成测试
- `test-wordpress.js` - WordPress连接测试
- `test-wordpress-enhancements.js` - WordPress增强功能测试
- `test-basic-auth.js` - 基础认证测试
- `test-wp-auth.js` - WordPress认证测试

### 批量处理测试
- `batch-ai-url_test.js` - 批量URL处理测试
- `test-ai-url.js` - 单URL AI处理测试
- `test-push.js` - 推送功能测试

### 验证工具
- `validate-wordpress.js` - WordPress配置验证
- `validate-wordpress-simple.js` - 简化验证工具

## 🛠️ 快速使用指南

### 初次设置
```bash
# 1. 配置WordPress
node setup/setup-remote-wordpress.js

# 2. 创建应用密码
node setup/create-app-password.js

# 3. 验证配置
node test/validate-wordpress.js
```

### 开发测试
```bash
# 测试AI功能
node test/test-ai-engines.js

# 测试统一prompt系统
node test/test-unified-prompts.js

# 批量URL测试
node test/batch-ai-url_test.js
```

### 生产运行
```bash
# 标准批量处理
node production/batch-ai-push.js urls.txt

# 增强版处理（推荐）
node production/batch-ai-push-enhanced.js config/config.remote.json examples/urls.txt
```

## 📊 工具选择建议

| 场景 | 推荐工具 | 备注 |
|------|----------|------|
| 首次配置 | `setup/setup-remote-wordpress.js` | 一次性设置 |
| 功能验证 | `test/test-ai-engines.js` | 确保AI正常 |
| 开发调试 | `test/batch-ai-url_test.js` | 生成测试报告 |
| 生产部署 | `production/batch-ai-push-enhanced.js` | 推荐使用 |
| 故障排除 | `setup/basic-auth-troubleshoot.js` | 解决认证问题 |

## 📋 注意事项

1. **环境要求**: 确保配置文件正确，AI引擎可用
2. **权限设置**: WordPress用户需要足够权限
3. **API限制**: 注意AI引擎调用频率限制
4. **测试优先**: 生产环境使用前请先测试

## 🔗 相关文档

- [AI功能指南](../docs/AI_FEATURES_GUIDE.md)
- [批量处理指南](../docs/BATCH_AI_GUIDE.md)
- [远程使用指南](../docs/REMOTE_USAGE.md)
- [Prompt统一化文档](../docs/AI_PROMPT_UNIFICATION.md)
