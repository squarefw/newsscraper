# AI质量深度测试工具使用指南

## 🎯 工具概述

AI质量深度测试工具专门用于测试和微调AI翻译(translate)、重写(rewrite)功能的质量。通过对比原文与AI输出结果，帮助您优化prompt配置，提升内容质量。

## 📁 文件结构

```
tools/test/
├── ai-quality-tester.js          # 主测试脚本（新增）
├── run-quality-test.sh           # 快速运行脚本（新增）
├── README.md                     # 使用说明（本文件）
└── [其他测试工具...]             # 原有的测试工具

examples/
└── quality-test-urls.txt         # 测试URL列表（新增）

reports/
└── ai-quality-test-*.md          # 生成的测试报告（新增）
```

## 🧪 核心测试工具

这些测试工具用于验证系统各项功能的正常运行：

## 📋 原有测试工具

### 🤖 AI测试工具
- `test-ai.js` - 基础AI功能测试，验证AI引擎工作状态
- `test-ai-url.js` - 单URL AI处理测试，生成详细质量报告
- `test-ai-engines.js` - AI引擎对比测试
- `test-unified-prompts.js` - 统一prompt功能测试

### 🔗 Google News测试工具
- `test-google-news.js` - Google News功能专项测试
- `test-google-news-quick.js` - Google News快速测试
- `test-google-news-redirects.js` - Google News重定向处理测试

### 📤 API推送测试工具
- `test-push.js` - API推送功能测试

### ⚙️ 配置测试工具
- `test-config-refactor.js` - 配置重构功能测试

## 🚀 使用方法

```bash
# 从项目根目录运行测试工具
node tools/test/[工具名称].js

# 常用示例：
node tools/test/test-ai.js                    # 测试AI基础功能
node tools/test/test-ai-url.js               # 测试单个URL的AI处理
node tools/test/test-google-news.js          # 测试Google News功能
node tools/test/test-push.js                 # 测试推送功能
```

## 📝 注意事项

- 这些工具主要用于开发和调试阶段
- 大部分工具不会对生产环境产生影响
- 测试结果通常输出到控制台或生成本地报告
- 运行前请确保相关配置文件已正确设置

---

**最后更新**: 2025年8月24日  
**状态**: 已清理和优化，保留核心功能测试工具
