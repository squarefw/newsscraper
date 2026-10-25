# Examples 文件夹

这个文件夹用于存储示例文件、测试数据和临时生成的文件。

## 📁 文件说明

### 自动生成的文件
这些文件会被脚本自动创建和更新，**不应提交到Git**：

- `pending-urls.txt` - 新闻发现系统生成的待处理URL队列
- `filter-report.txt` - AI新闻筛选系统生成的过滤报告

### 手动测试
`pending-urls.txt` 可直接作为 `batch-ai-push` 的输入；需要自定义测试时新建自己的 URL 文件即可（格式为每行一个 URL）。

## 🚫 注意事项

- **所有文件都已添加到 `.gitignore`**，不会被提交到仓库
- 这些文件包含动态数据，每次运行都会发生变化
- 可能包含敏感的新闻源信息，不适合公开

## 📝 使用方法

### 创建URL文件
```bash
# 创建测试URL文件
echo "https://example-news.com/article1" > examples/test-urls.txt
echo "https://example-news.com/article2" >> examples/test-urls.txt
```

### 运行处理脚本
```bash
# 使用examples中的URL文件
node src/services/batch-ai-push.js config/config.remote-aliyun.json examples/test-urls.txt
```

### 查看生成的报告
```bash
# 查看AI过滤报告
cat examples/filter-report.txt

# 查看待处理URL队列
cat examples/pending-urls.txt
```

## 🔄 文件生命周期

1. **新闻发现** → 生成 `pending-urls.txt`
2. **AI筛选** → 生成 `filter-report.txt` 
3. **批量处理** → 读取URL文件，处理新闻
4. **下次运行** → 文件被覆盖更新

---

⚠️ **重要**: 此文件夹中的所有文件（除本README外）都不会被Git跟踪，确保了数据安全和仓库整洁。
