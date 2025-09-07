/**
 * 新闻文章链接筛选器
 * 使用AI识别真正的新闻文章页面，过滤掉分类页面、导航页面等
 */

const fs = require('fs');
const path = require('path');

class NewsArticleFilter {
    constructor(multiAIManager, config = {}) {
        this.multiAIManager = multiAIManager;
        this.config = {
            aiEngine: 'gemini', // This is now just a fallback
            confidenceThreshold: 5,
            reporting: {
                enabled: true,
                reportPath: 'examples/filter-report.txt'
            },
            ...config
        };
        
        // The actual engine used will be determined by multiAIManager.getAgentForTask('article_filter')
        // We keep this.config.aiEngine for logging and reporting purposes.
        const actualEngine = this.multiAIManager.getEngineNameForTask('article_filter');
        if (actualEngine) {
            this.config.aiEngine = actualEngine;
        }

        this.filterPrompt = `你是一个新闻链接筛选专家。请分析给定的URL和页面内容，判断这是否是一个具体的新闻文章页面。

判断标准：
✅ 是新闻文章页面的特征：
- URL包含具体日期、文章ID或标题slug
- 页面标题是完整的新闻标题（通常较长，描述具体事件）
- 内容是完整的新闻报道，有详细的事实描述
- URL路径指向具体文章，如：/news/politics/title-123.html, /2025/08/22/news-title/

❌ 不是新闻文章页面的特征：
- URL指向分类页面，如：/news/, /sports/, /politics/
- URL指向导航页面，如：/news/celebs/, /crime/courts/
- 页面标题是分类名称，如："Sports", "News", "Celebrities"
- 内容是文章列表或导航链接，而非单篇文章内容
- URL路径过于简短或通用

请基于以下信息进行判断：

URL: {url}
页面标题: {title}
内容长度: {contentLength}字符
内容预览: {contentPreview}

请回答：
1. 判断结果：是/否
2. 置信度：1-10（10表示非常确信）
3. 判断理由：简要说明判断依据

格式：判断结果|置信度|理由`;
    }

    /**
     * 筛选新闻文章链接
     * @param {Array} urlData - 包含URL和内容信息的数组
     * @returns {Array} 筛选后的新闻文章链接
     */
    async filterNewsArticles(urlData) {
        console.log(`🔍 开始AI筛选新闻文章链接 (${urlData.length}个链接)`);
        console.log(`📋 使用引擎: ${this.config.aiEngine}`);
        
        const newsArticles = [];
        const filteredOut = [];
        
        for (let i = 0; i < urlData.length; i++) {
            const data = urlData[i];
            console.log(`\n📋 筛选 ${i + 1}/${urlData.length}: ${data.url}`);
            
            try {
                const isNewsArticle = await this.analyzeUrlWithAI(data);
                
                if (isNewsArticle.result) {
                    newsArticles.push(data.url);
                    console.log(`   ✅ 新闻文章 (置信度: ${isNewsArticle.confidence}/10) - ${isNewsArticle.reason}`);
                } else {
                    filteredOut.push({
                        url: data.url,
                        reason: isNewsArticle.reason,
                        confidence: isNewsArticle.confidence
                    });
                    console.log(`   ❌ 非新闻文章 (置信度: ${isNewsArticle.confidence}/10) - ${isNewsArticle.reason}`);
                }
            } catch (error) {
                console.log(`   ⚠️ 分析失败: ${error.message}，默认保留`);
                newsArticles.push(data.url);
            }
        }
        
        console.log(`\n📊 筛选完成：`);
        console.log(`   ✅ 新闻文章: ${newsArticles.length}个`);
        console.log(`   ❌ 已过滤: ${filteredOut.length}个`);
        
        // 保存过滤报告
        if (this.config.reporting.enabled) {
            await this.saveFilterReport(newsArticles, filteredOut);
        }
        
        return newsArticles;
    }

    /**
     * 使用AI分析单个URL是否为新闻文章
     */
    async analyzeUrlWithAI(data) {
        const contentPreview = data.content ? 
            data.content.substring(0, 500).replace(/\s+/g, ' ').trim() : 
            '无内容';
        
        const prompt = this.filterPrompt
            .replace('{url}', data.url)
            .replace('{title}', data.title || '无标题')
            .replace('{contentLength}', data.content ? data.content.length : 0)
            .replace('{contentPreview}', contentPreview);

        // 获取article_filter任务对应的AI引擎并进行分析
        const engine = this.multiAIManager.getAgentForTask('article_filter');
        const response = await engine.processContent(prompt, 'article_filter');
        
        // 解析AI响应
        const parts = response.split('|');
        if (parts.length >= 3) {
            const result = parts[0].trim().toLowerCase();
            const confidence = parseInt(parts[1].trim()) || 5;
            const reason = parts[2].trim();
            
            return {
                result: result === '是' || result === 'yes' || result.includes('是'),
                confidence: confidence,
                reason: reason
            };
        }
        
        // 如果AI响应格式不正确，返回默认拒绝
        return {
            result: false,
            confidence: 3,
            reason: 'AI响应格式不正确，默认拒绝'
        };
    }

    /**
     * 保存筛选报告
     */
    async saveFilterReport(newsArticles, filteredOut) {
        const reportPath = path.resolve(this.config.reporting.reportPath);
        const timestamp = new Date().toISOString();
        
        let report = `新闻文章筛选报告\n`;
        report += `时间: ${timestamp}\n`;
        report += `筛选方法: AI筛选\n`;
        report += `AI引擎: ${this.config.aiEngine}\n`;
        report += `总链接数: ${newsArticles.length + filteredOut.length}\n`;
        report += `新闻文章: ${newsArticles.length}\n`;
        report += `已过滤: ${filteredOut.length}\n\n`;
        
        report += `=== 保留的新闻文章 ===\n`;
        newsArticles.forEach((url, index) => {
            report += `${index + 1}. ${url}\n`;
        });
        
        report += `\n=== 过滤掉的链接 ===\n`;
        filteredOut.forEach((item, index) => {
            report += `${index + 1}. ${item.url}\n`;
            report += `   原因: ${item.reason} (置信度: ${item.confidence}/10)\n\n`;
        });
        
        await fs.promises.writeFile(reportPath, report, 'utf8');
        console.log(`📄 筛选报告已保存: ${reportPath}`);
    }
}

module.exports = NewsArticleFilter;
