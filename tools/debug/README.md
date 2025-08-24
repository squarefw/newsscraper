# 新闻系统调试工具使用指南

## 概述

为了提高新闻抓取系统的效率和质量，我们创建了专门的调试工具来分离和优化各个功能模块。

## 工具说明

### 1. 简化的URL解析器 (`utils/puppeteerResolver_simple.js`)

**功能**: 只保留最有效的Puppeteer方法，删除经常失败的静态解码和重定向方法。

**特点**:
- 专注于Puppeteer动态抓取
- 优化的链接筛选逻辑
- 支持批量处理和并发控制
- 减少无效请求和超时

### 2. Google News抓取调试器 (`tools/debug/google-news-fetcher.js`)

**功能**: 专门调试Google News URL的抓取功能。

**使用方法**:
```bash
# 使用默认配置
node tools/debug/google-news-fetcher.js

# 指定配置文件
node tools/debug/google-news-fetcher.js config/config.remote-230.json
```

**输出结果**:
- `examples/google-news-debug-results.json` - 详细调试报告
- `examples/google-news-debug-results.txt` - 抓取到的URL列表

**报告内容**:
- 每个新闻源的处理结果
- 原始链接数量 vs 解码后链接数量
- 成功率统计
- 处理时间分析
- 错误信息记录

### 3. 新闻筛选调试器 (`tools/debug/news-filter-tester.js`)

**功能**: 对比AI筛选和规则筛选的效果。

**使用方法**:
```bash
# 使用默认URL文件
node tools/debug/news-filter-tester.js

# 指定配置和URL文件
node tools/debug/news-filter-tester.js config/config.remote-230.json examples/google-news-debug-results.txt
```

**输出结果**:
- `examples/filter-analysis-report.json` - 详细分析报告
- `examples/filter-analysis-report.txt` - 文本格式总结

**报告内容**:
- AI筛选 vs 规则筛选结果对比
- 每个URL的详细分析
- 方法一致性统计
- 处理时间对比
- 推荐的筛选策略

## 使用流程

### 第一步: 调试Google News抓取
```bash
cd /Users/weifang/Sites/i0086/site/newsscraper
node tools/debug/google-news-fetcher.js config/config.remote-230.json
```

这会:
1. 从Google News源抓取原始编码URL
2. 使用简化的Puppeteer解析器解码
3. 生成详细的抓取报告
4. 保存URL列表供下一步使用

### 第二步: 调试新闻筛选
```bash
node tools/debug/news-filter-tester.js config/config.remote-230.json examples/google-news-debug-results.txt
```

这会:
1. 分析第一步获得的URL内容
2. 分别执行AI筛选和规则筛选
3. 对比两种方法的效果
4. 生成筛选优化建议

### 第三步: 优化配置
根据调试报告调整配置:

1. **如果Puppeteer成功率低**: 调整超时时间、并发数量
2. **如果AI筛选太严格**: 降低confidenceThreshold
3. **如果规则筛选效果好**: 切换到rule方法
4. **如果某些新闻源效果差**: 调整关键词或禁用

## 配置优化建议

### URL解析器优化
```json
{
  "discovery": {
    "urlResolver": {
      "timeout": 30000,        // Puppeteer超时时间
      "concurrency": 2,        // 并发数量（避免被封）
      "enablePuppeteer": true  // 启用Puppeteer方法
    }
  }
}
```

### 筛选器优化
```json
{
  "discovery": {
    "articleFilter": {
      "enabled": true,
      "method": "rule",              // 或 "ai"
      "maxLinksToAnalyze": 20,       // 限制分析数量
      "confidenceThreshold": 6,      // AI筛选阈值
      "ruleBasedSettings": {
        "scoreThreshold": 25,        // 规则筛选阈值
        "urlPatternWeight": 30,
        "titleWeight": 20,
        "contentWeight": 25,
        "pathDepthWeight": 10
      }
    }
  }
}
```

## 性能监控

### 关键指标
1. **抓取成功率**: 应该 > 70%
2. **筛选精确度**: AI和规则方法一致性 > 60%
3. **处理速度**: 单个URL < 10秒
4. **错误率**: < 20%

### 常见问题排查

**抓取成功率低**:
- 检查网络连接
- 调整User-Agent
- 增加超时时间
- 减少并发数量

**筛选结果不理想**:
- 调整confidenceThreshold
- 更新关键词列表
- 检查新闻源质量
- 对比AI和规则方法

**处理速度慢**:
- 减少maxLinksToAnalyze
- 优化Puppeteer配置
- 使用规则筛选替代AI筛选

## 后续优化计划

1. **模块化重构**: 将各功能完全分离为独立模块
2. **缓存机制**: 添加URL和内容缓存避免重复请求
3. **智能筛选**: 结合AI和规则的混合筛选策略
4. **监控系统**: 实时监控系统性能和成功率

## 注意事项

1. **调试时限制URL数量**: 避免测试时间过长
2. **控制请求频率**: 避免被目标网站封禁
3. **定期更新配置**: 根据调试结果持续优化
4. **监控资源使用**: Puppeteer会消耗较多内存

通过这些调试工具，您可以:
- 独立测试每个功能模块
- 快速定位性能瓶颈
- 优化系统配置
- 提高整体效率和质量
