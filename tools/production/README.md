# 生产工具目录

这个目录包含了用于生产环境的核心工具。

## 📋 文件列表

### 批量处理工具
- `batch-ai-push.js` - 标准批量AI处理和推送工具
- `batch-ai-push-enhanced.js` - 增强版批量处理工具，支持更多配置选项

### 管理工具
- `category-manager.js` - 新闻分类和标签管理器
- `run-remote.sh` - 远程服务器执行脚本

## 🚀 使用方法

```bash
# 标准批量处理
node tools/production/batch-ai-push.js [URL文件路径]

# 增强版批量处理（推荐）
node tools/production/batch-ai-push-enhanced.js [配置文件] [URL文件路径]

# 分类管理
node tools/production/category-manager.js

# 远程执行
./tools/production/run-remote.sh
```

## 🎯 典型使用场景

### 日常内容处理
```bash
# 使用增强版工具处理新闻
node tools/production/batch-ai-push-enhanced.js config/config.remote-230.json examples/wordpress-test-urls.txt
```

### 大批量处理
```bash
# 处理大量URL文件
node tools/production/batch-ai-push.js production-urls.txt
```

## ⚠️ 注意事项

- **生产环境工具**：这些工具会直接影响生产环境
- **配置文件**：请确保使用正确的生产配置文件
- **API限制**：注意相关API的调用频率限制
- **错误处理**：工具包含完善的错误处理和重试机制
- **日志记录**：所有操作都会记录详细日志

## 🔒 安全提醒

- 运行前请确认目标环境和配置
- 建议先用小批量数据测试
- 定期备份重要数据
- 监控处理过程和结果
