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

## 🆕 新增：AI质量测试工具

### 🚀 快速开始

#### 1. 基础测试（推荐新手）

使用默认配置进行快速测试：

```bash
cd tools/test
./run-quality-test.sh default
```

这将：
- 使用 `config/config.remote-230.json` 的默认AI引擎配置
- 测试 `examples/quality-test-urls.txt` 中的URL
- 生成详细的质量报告

#### 2. 多引擎对比测试

对比不同AI引擎的质量差异：

```bash
./run-quality-test.sh multi
```

这将同时测试qwen和gemini引擎，生成对比报告。

#### 3. 单引擎专项测试

测试特定AI引擎：

```bash
# 测试Qwen引擎
./run-quality-test.sh qwen

# 测试Gemini引擎  
./run-quality-test.sh gemini
```

### 🔧 高级用法

#### 直接使用Node.js脚本

```bash
cd tools/test

# 基础测试
node ai-quality-tester.js ../../config/config.remote-230.json ../../examples/quality-test-urls.txt

# 多引擎对比
node ai-quality-tester.js ../../config/config.remote-230.json ../../examples/quality-test-urls.txt --engines=qwen,gemini

# 指定输出路径
node ai-quality-tester.js ../../config/config.remote-230.json ../../examples/quality-test-urls.txt --output=my-test-report.md
```

## 📊 报告解读

测试完成后，会在 `reports/` 目录生成详细报告，包含：

### 1. 测试总览
- 总测试次数、成功率、平均响应时间

### 2. 详细结果
每个URL的测试结果包含：
- **原文信息**：提取的标题和内容
- **翻译结果**：AI翻译的中文版本
- **重写结果**：AI重新组织后的最终版本
- **性能数据**：每步处理的耗时

### 3. 质量分析
- 性能指标统计、优化建议、引擎对比

## 🎯 质量微调指南

1. **识别问题**：检查翻译质量、段落结构、语言风格、AI痕迹
2. **优化prompt**：调整 `config/ai-prompts.json` 中的相关prompt
3. **重新测试**：验证改进效果
4. **对比结果**：确认优化成果

---

## 📋 原有测试工具

### AI测试工具
- `test-ai.js` - 基础AI功能测试
- `test-ai-url.js` - 单URL AI处理测试
- `test-ai-processor.js` - AI处理器测试
- `batch-ai-url_test.js` - 批量URL测试（生成报告）

### WordPress测试工具
- `test-wordpress.js` - WordPress基础功能测试
- `test-wordpress-enhancements.js` - WordPress增强功能测试
- `test-remote-wordpress.js` - 远程WordPress测试
- `test-wp-auth.js` - WordPress认证测试
- `test-wp-basic-auth.js` - WordPress基础认证测试
- `test-basic-auth.js` - 基础认证测试

### 验证工具
- `validate-wordpress.js` - WordPress配置验证
- `validate-wordpress-simple.js` - WordPress简单验证

### 其他测试工具
- `test-push.js` - API推送测试
- `test-new-user.js` - 新用户功能测试
- `test-dynamic-categories.js` - 动态分类测试

## 🚀 使用方法

```bash
# 运行测试工具（从项目根目录）
node tools/test/[工具名称].js

# 例如：
node tools/test/test-ai.js
node tools/test/test-ai-url.js
node tools/test/batch-ai-url_test.js examples/sample-urls.txt
```

## 📝 注意事项

- 这些工具主要用于开发和调试阶段
- 大部分工具不会对生产环境产生影响
- 测试结果通常输出到控制台或生成本地报告
- 运行前请确保相关配置文件已正确设置

---

**最后更新**: 2025年8月19日  
**新增功能**: AI质量深度测试工具
