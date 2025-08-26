# 阿里云生产环境配置说明

## 快速开始

### 1. 使用快速启动脚本
```bash
# 正常运行
./start-aliyun.sh

# 测试运行（不实际推送到WordPress）
./start-aliyun.sh --dry-run

# 限制处理文章数量
./start-aliyun.sh --max-articles 5

# 跳过发现阶段，直接处理队列
./start-aliyun.sh --skip-discovery

# 组合使用
./start-aliyun.sh --dry-run --max-articles 3
```

### 2. 直接使用Node.js
```bash
# 基本运行
node run-aliyun-production.js

# 使用环境变量
DRY_RUN=true MAX_ARTICLES=5 node run-aliyun-production.js
```

## 配置文件

### 必需文件
1. `config/config.remote-aliyun.json` - 阿里云环境配置
2. `config/api-keys.json` - API密钥配置
3. `config/targets.json` - 目标RSS源配置

### 可选文件
1. `config/category-mapping.json` - 分类映射配置
2. `config/ai-prompts.json` - AI提示词配置

## 运行模式

### 正常模式
- 发现新文章 → AI处理 → 推送到WordPress
- 增量抓取，基于WordPress最新文章时间戳
- 完整的错误处理和重试机制

### 干运行模式（--dry-run）
- 执行所有步骤但不推送到WordPress
- 用于测试配置和调试
- 生成完整的日志和报告

### 跳过发现模式（--skip-discovery）
- 直接处理现有的pending-urls队列
- 适用于已经有待处理文章的情况
- 节省发现阶段的时间

## 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| DRY_RUN | false | 干运行模式 |
| MAX_ARTICLES | 20 | 最大处理文章数量 |
| SKIP_DISCOVERY | false | 跳过发现阶段 |
| CLEANUP | true | 运行后清理临时文件 |
| LOG_LEVEL | info | 日志级别 (error/warn/info/debug) |

## 日志和输出

### 日志文件
- `logs/aliyun-production.log` - 详细运行日志
- `logs/aliyun-production-report.json` - 结构化运行报告
- `logs/discover-queue-*.log` - 发现阶段日志
- `logs/batch-ai-push-*.log` - AI处理和推送日志

### 控制台输出
- 彩色状态信息
- 进度指示
- 错误和警告提示
- 运行统计信息

## 故障排除

### 常见问题

1. **WordPress连接失败**
   ```
   检查 config/config.remote-aliyun.json 中的 WordPress 配置
   确认 WordPress 用户权限正确
   ```

2. **API密钥错误**
   ```
   检查 config/api-keys.json
   确认各个AI服务的密钥有效
   ```

3. **RSS获取失败**
   ```
   检查网络连接
   确认 targets.json 中的RSS源可访问
   ```

4. **内存不足**
   ```
   减少 MAX_ARTICLES 的值
   增加系统内存
   ```

### 调试步骤

1. **启用详细日志**
   ```bash
   LOG_LEVEL=debug ./start-aliyun.sh --dry-run
   ```

2. **检查配置**
   ```bash
   node -e "console.log(JSON.stringify(require('./config/config.remote-aliyun.json'), null, 2))"
   ```

3. **测试单个组件**
   ```bash
   # 测试发现功能
   node tools/production/discover-and-queue.js

   # 测试AI处理
   node tools/production/batch-ai-push.js
   ```

## 监控和维护

### 定期检查
- 日志文件大小（自动轮转）
- WordPress存储空间
- API配额使用情况
- 系统资源占用

### 性能优化
- 根据服务器性能调整并发数
- 优化AI处理批次大小
- 合理设置重试间隔

### 安全考虑
- 定期更新API密钥
- 监控异常访问模式
- 备份重要配置文件

## 部署建议

### 系统要求
- Node.js 16+
- 内存: 2GB+
- 磁盘: 1GB+ 可用空间
- 网络: 稳定的互联网连接

### 生产环境
- 使用 PM2 或 systemd 进行进程管理
- 配置日志轮转
- 设置监控和告警
- 定期备份配置

### 示例 PM2 配置
```json
{
  "name": "news-scraper-aliyun",
  "script": "run-aliyun-production.js",
  "instances": 1,
  "exec_mode": "fork",
  "env": {
    "NODE_ENV": "production",
    "MAX_ARTICLES": 20
  },
  "log_file": "logs/pm2-combined.log",
  "error_file": "logs/pm2-error.log",
  "out_file": "logs/pm2-out.log",
  "cron_restart": "0 */6 * * *"
}
```

### 示例 Cron 配置
```bash
# 每6小时运行一次
0 */6 * * * cd /path/to/newsscraper && ./start-aliyun.sh >> logs/cron.log 2>&1

# 每天凌晨清理日志
0 0 * * * find /path/to/newsscraper/logs -name "*.log" -mtime +7 -delete
```
