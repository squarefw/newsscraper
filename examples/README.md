# NewsScraper 示例文件

这个文件夹包含了各种示例配置和测试文件。

## 📄 文件说明

### `sample-urls.txt`
**批量处理URL示例**
- 包含测试用的新闻URL列表
- 用于 `tools/test/batch-ai-url_test.js` 批量处理
- 格式：每行一个URL，# 开头为注释

## 🚀 使用方法

### 批量URL处理
```bash
# 使用示例URL文件
node tools/test/batch-ai-url_test.js examples/sample-urls.txt

# 创建自己的URL文件
cp examples/sample-urls.txt my-urls.txt
# 编辑 my-urls.txt 添加你的URL
node tools/test/batch-ai-url_test.js my-urls.txt
```

### URL文件格式
```
# 这是注释行，会被忽略
# 每行一个有效的URL

https://www.bbc.com/news/world-europe-68123456
https://www.rte.ie/news/ireland/2025/0730/1525999-example/
https://example-news.com/article/sample-news
```

## 💡 提示

- URL必须以 `http://` 或 `https://` 开头
- 避免使用需要登录或有反爬虫保护的网站
- 建议每批处理10-20个URL以获得最佳性能
- 可以复制这些示例文件作为模板创建自己的配置
