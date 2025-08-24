# 批量AI处理脚本使用指南

## 📋 功能描述

`batch-ai-url.js` 是一个批量处理新闻URL的脚本，可以：

- 从文件读取多个新闻URL
- 自动提取每个URL的新闻内容
- 对每篇新闻按顺序执行所有AI任务
- 生成包含原文和最终处理结果的详细报告

## 🚀 使用方法

### 1. 基本用法
```bash
node batch-ai-url.js <URL文件路径>
```

### 2. 使用示例文件
```bash
# 直接运行，会提示创建示例文件
node batch-ai-url.js

# 使用示例文件
node batch-ai-url.js sample-urls.txt
```

### 3. 自定义URL文件
创建自己的URL文件（如 `my-urls.txt`）：
```bash
# 我的新闻URL列表
# 以 # 开头的行为注释

https://www.bbc.com/news/world-europe-68123456
https://www.rte.ie/news/ireland/2025/0730/1525999-example/
https://example-news.com/article/sample-news
```

然后运行：
```bash
node batch-ai-url.js my-urls.txt
```

## 📊 处理流程

对于每个URL，脚本会：

1. **内容提取** - 自动提取标题和正文
2. **AI任务序列** - 按配置顺序执行AI任务：
   - `translate` - 翻译（如果是外文）
   - `rewrite` - 重写优化
   - `summarize` - 生成摘要
   - `extract_keywords` - 提取关键词
   - `categorize` - 智能分类
   - `sentiment` - 情感分析
3. **结果保存** - 记录原文和最终处理结果

## 📄 报告格式

生成的报告包含：

### 批量统计信息
- 总处理URL数量
- 成功/失败统计
- 总耗时和平均耗时
- AI任务成功率

### 每个URL的详细结果
- 原始标题和正文
- 最终处理后的内容
- 各AI任务的执行情况
- 关键信息提取（关键词、分类、情感、摘要）

### 数据分析
- 内容长度变化分析
- AI任务成功率统计
- 优化建议

## ⚙️ 配置说明

脚本使用 `config/config.remote.json` 中的AI配置：

```json
{
  "ai": {
    "enabled": true,
    "engine": "ollama",
    "ollama": {
      "baseUrl": "http://localhost:11434",
      "model": "qwen3:14b"
    },
    "tasks": [
      "translate",
      "rewrite", 
      "summarize",
      "extract_keywords",
      "categorize",
      "sentiment"
    ]
  }
}
```

## 📁 输出文件

- **报告位置**: `reports/batch-ai-report-YYYY-MM-DDTHH-mm-ss.md`
- **报告格式**: Markdown格式，便于查看和分享

## 🔧 故障排除

### 常见问题

**Q: 脚本运行出错**
```bash
# 确保项目已构建
npm run build

# 检查AI配置
node -e "console.log(require('./config/config.remote.json').ai)"
```

**Q: URL提取失败**
- 检查网站是否可访问
- 某些网站可能有反爬虫机制

**Q: AI处理超时**
- 检查Ollama服务是否运行
- 增加配置中的timeout设置

**Q: 内存不足**
- 减少批量处理的URL数量
- 分批次处理大量URL

### 性能优化

1. **批量大小**: 建议每次处理10-20个URL
2. **网络延迟**: 脚本自动在URL间添加2秒延迟
3. **AI模型**: 使用较小的模型可提高速度
4. **并发控制**: 当前为串行处理，确保稳定性

## 💡 使用技巧

1. **测试单个URL**: 先用 `test-ai-url.js` 测试单个URL
2. **分批处理**: 大量URL建议分多个文件处理
3. **监控日志**: 观察控制台输出了解处理进度
4. **备份配置**: 处理前备份重要配置文件

## 📈 预期性能

基于当前配置的性能指标：

- **单URL处理时间**: 30-60秒（包含6个AI任务）
- **10个URL批量**: 约10-15分钟
- **成功率**: >90%（网络和AI服务正常时）
- **报告大小**: 每个URL约2-5KB的报告内容

## 🆚 与单URL测试的区别

| 功能 | test-ai-url.js | batch-ai-url.js |
|------|----------------|-----------------|
| URL数量 | 1个 | 多个 |
| 交互方式 | 交互式输入 | 文件批量 |
| 报告详细度 | 极详细 | 汇总+详情 |
| 处理时间 | 短 | 长 |
| 适用场景 | 测试调试 | 生产批量 |
