const fs = require('fs');
const path = require('path');
const markdownExtractor = require('../utils/markdownExtractor');

class NewsArticleFilter {
    constructor(multiAIManager, config = {}) {
        this.multiAIManager = multiAIManager;
        this.config = {
            aiEngine: 'qwen', 
            confidenceThreshold: 6, // 提高门槛
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
        
        // 分批处理，防止并发过高
        const batchSize = 5;
        for (let i = 0; i < urlData.length; i += batchSize) {
            const batch = urlData.slice(i, i + batchSize);
            console.log(`\n📦 正在处理批次 ${Math.floor(i/batchSize) + 1}/${Math.ceil(urlData.length/batchSize)} (${batch.length}个链接)...`);
            
            const results = await Promise.all(batch.map(async (data, index) => {
                const itemNum = i + index + 1;
                try {
                    const isNewsArticle = await this.analyzeUrlWithAI(data);
                    return { data, isNewsArticle, itemNum };
                } catch (error) {
                    console.log(`   [${itemNum}] ⚠️ 分析失败: ${error.message}，默认保留`);
                    return { data, isNewsArticle: { result: true, confidence: 5, reason: '分析异常，默认保留' }, itemNum };
                }
            }));

            for (const res of results) {
                if (res.isNewsArticle.result) {
                    newsArticles.push(res.data.url);
                    console.log(`   [${res.itemNum}] ✅ 是文章 (置信度: ${res.isNewsArticle.confidence}) - ${res.isNewsArticle.reason}`);
                } else {
                    filteredOut.push({
                        url: res.data.url,
                        reason: res.isNewsArticle.reason,
                        confidence: res.isNewsArticle.confidence
                    });
                    console.log(`   [${res.itemNum}] ❌ 非文章 (置信度: ${res.isNewsArticle.confidence}) - ${res.isNewsArticle.reason}`);
                }
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
     * 关键词预过滤：检测死亡公告/讣告类内容
     * 注意：只过滤讣告/死亡公告/葬礼通知，不过滤事故/犯罪等有人员死亡的正常新闻报道
     * @returns {Object|null} 如果是死亡公告返回过滤结果，否则返回null继续AI分析
     */
    _checkDeathNotice(data) {
        const title = (data.title || '').toLowerCase();
        const url = (data.url || '').toLowerCase();
        // 从内容中截取前1000字符作为检测范围
        const contentPreview = (data.content || '').substring(0, 1000).toLowerCase();
        const combinedText = `${title} ${url} ${contentPreview}`;

        // 英文关键词 - 只包含明确标识讣告/死亡公告的模式
        // 不包含 "dies after", "killed in", "has died" 等会误伤事故新闻的词
        const englishKeywords = [
            // URL路径中的明确标识
            '/obituaries/', '/obituary/', '/death-notice/', '/death_notice/',
            'rip.ie/death-notice', 'rip.ie/death_notice',
            '/funeral-notice/', '/funeral_notice/',

            // 讣告特有的行文模式（事故新闻不会用这些）
            'passed away peacefully', 'passed away surrounded',
            'passed away at the peace', 'died peacefully',
            'in his/her', 'in her/his',
            'is survived by', 'predeceased by', 'pre-deceased by',
            'deeply and sadly missed', 'will be sadly missed',
            'will be lovingly remembered', 'fondly remembered',
            'peacefully in the presence of', 'in the loving presence of',
            'at the peaceful presence of',
            'gone home to be with', 'called home to',
            'rest in peace', 'rip ', 'r.i.p.',
            'in memoriam', 'in loving memory of',
            'in sad and loving memory',

            // 讣告/葬礼通知的标题格式
            'obituary:', 'obituary -',
            'death notice:', 'death notice -',
            'funeral notice:', 'funeral notice -',
            'funeral details:', 'funeral details -',
            'funeral mass will be', 'repose will be',
            'removal from', 'removal to',
            'requiescat in pace',

            // 特定以死亡公告为主的内容站点路径
            'death-notices/', 'obituary-section'
        ];

        // 中文关键词 - 只包含明确标识讣告/死亡公告的词
        // 不包含 "去世"、"逝世"、"死亡" 等会出现在事故新闻中的宽泛词
        const chineseKeywords = [
            // 明确的讣告/公告类型
            '死亡公告', '讣告', '讣闻',
            '沉痛悼念', '深切哀悼', '哀悼通知',

            // 传统讣告用语（事故新闻不会用）
            '享年', '享寿', '享龄',
            '与世长辞', '千古', '驾鹤西去', '仙逝',
            '寿终正寝', '寿终内寝',

            // 葬礼/追悼通知
            '追悼会', '告别仪式', '遗体告别',
            '出殡', '安葬', '落葬',
            '治丧委员会', '灵堂',

            // 死亡通知特有格式
            '谨定于', '兹定于', '谨遵',
            '兹有我', '不幸病逝', '因病医治无效',

            // 特定死亡公告网站
            'rip.ie/death-notice', 'rip.ie/death_notice'
        ];

        // 检查英文关键词
        for (const keyword of englishKeywords) {
            if (combinedText.includes(keyword)) {
                return {
                    result: false,
                    confidence: 9,
                    reason: `关键词预过滤拦截（死亡公告/讣告）：匹配到 "${keyword}"`,
                    details: { qualityScore: 1, matchScore: 1 }
                };
            }
        }

        // 检查中文关键词
        for (const keyword of chineseKeywords) {
            if (combinedText.includes(keyword)) {
                return {
                    result: false,
                    confidence: 9,
                    reason: `关键词预过滤拦截（死亡公告/讣告）：匹配到 "${keyword}"`,
                    details: { qualityScore: 1, matchScore: 1 }
                };
            }
        }

        // URL路径中包含obituaries的
        if (url.includes('/obituaries') || url.includes('/obituary')) {
            return {
                result: false,
                confidence: 10,
                reason: 'URL路径包含obituaries/obituary，判定为讣告页面',
                details: { qualityScore: 1, matchScore: 1 }
            };
        }

        return null; // 不是死亡公告，继续AI分析
    }

    /**
     * 使用AI分析单个URL是否为新闻文章
     */
    async analyzeUrlWithAI(data) {
        // 0. 关键词预过滤：直接拦截死亡公告/讣告类内容
        const deathNoticeResult = this._checkDeathNotice(data);
        if (deathNoticeResult) {
            return deathNoticeResult;
        }

        // 1. 将 HTML 转换为 Markdown 以增强 AI 理解
        const markdownContent = markdownExtractor.convert(data.content || '');
        
        // 2. 准备 Prompt 数据
        // 如果内容太长，截取中间和开头部分
        const maxChars = 6000;
        let processedContent = markdownContent;
        if (markdownContent.length > maxChars) {
            processedContent = markdownContent.substring(0, maxChars / 2) + 
                             '\n\n[...内容过长，已截取...]\n\n' + 
                             markdownContent.substring(markdownContent.length - maxChars / 2);
        }

        // 3. 获取特定的 article_qualification 代理并执行
        const engine = this.multiAIManager.getAgentForTask('article_qualification');
        const response = await engine.processContent({
            url: data.url,
            title: data.title || '无标题',
            content: processedContent
        }, 'article_qualification');
        
        // 解析格式: 是否采纳|质量分|匹配度|理由
        const parts = response.split('|');
        if (parts.length >= 4) {
            const accept = parts[0].trim();
            const qualityScore = parseInt(parts[1]) || 0;
            const matchScore = parseInt(parts[2]) || 0;
            const reason = parts[3].trim();
            
            return {
                result: accept === '是' || accept.toLowerCase() === 'yes',
                confidence: Math.round((qualityScore + matchScore) / 2),
                reason: reason,
                details: { qualityScore, matchScore }
            };
        }
        
        // 降级解析 (支持旧格式或其他异常)
        return {
            result: response.includes('是') || response.toLowerCase().includes('yes'),
            confidence: 5,
            reason: response.substring(0, 100)
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

    /**
     * 批处理版：一次 AI 调用完成所有文章的资格审查 + 批次内去重
     * @param {Array} articlesData - 包含 {url, title, content} 的数组
     * @returns {Object} { qualified: string[], filtered: Array, duplicates: Array }
     */
    async filterNewsArticlesBatch(articlesData) {
        console.log(`\n🚀 开始批处理筛选 (${articlesData.length} 篇文章)...`);
        console.log(`📋 使用引擎: ${this.config.aiEngine} | 模式: 批处理`);

        // 1. 关键词预过滤（不用 AI）
        const afterKeywordFilter = [];
        const keywordFiltered = [];

        for (const data of articlesData) {
            const deathResult = this._checkDeathNotice(data);
            if (deathResult) {
                keywordFiltered.push({
                    url: data.url,
                    reason: deathResult.reason,
                    confidence: deathResult.confidence
                });
            } else {
                afterKeywordFilter.push(data);
            }
        }

        console.log(`   🔍 关键词预过滤: ${articlesData.length} → ${afterKeywordFilter.length} (过滤 ${keywordFiltered.length} 篇讣告/死亡公告)`);

        if (afterKeywordFilter.length === 0) {
            console.log('   ⚠️ 所有文章都被关键词过滤，无需 AI 调用');
            return {
                qualified: [],
                filtered: keywordFiltered,
                duplicates: [],
                method: 'keyword_only'
            };
        }

        // 2. 准备批处理数据（JSON 格式）
        const batchInput = afterKeywordFilter.map(article => ({
            url: article.url,
            title: article.title || '无标题',
            content: (article.content || '').substring(0, 10000) // 限制 10000 字符
        }));

        // 3. 调用 AI 批处理
        try {
            console.log(`   🤖 发送 ${afterKeywordFilter.length} 篇文章进行 AI 批处理...`);

            const engine = this.multiAIManager.getAgentForTask('article_qualification');
            const prompt = await this._buildBatchPrompt(batchInput);
            const response = await engine.processContent(prompt, 'article_qualification_batch');

            // 4. 解析 JSON 响应
            const results = this._parseBatchResponse(response, afterKeywordFilter);

            // 5. 分类结果
            const qualified = [];
            const aiFiltered = [];
            const duplicates = [];

            for (const result of results) {
                if (!result.qualified) {
                    aiFiltered.push({
                        url: result.url,
                        reason: result.reason || '不符合资格审查标准',
                        confidence: result.score || 5
                    });
                } else if (result.isDuplicate) {
                    duplicates.push({
                        url: result.url,
                        reason: `与 ${result.duplicateOf} 重复`,
                        duplicateOf: result.duplicateOf
                    });
                } else {
                    qualified.push(result.url);
                }
            }

            console.log(`\n📊 批处理完成：`);
            console.log(`   ✅ 合格文章: ${qualified.length} 篇`);
            console.log(`   ❌ AI 过滤: ${aiFiltered.length} 篇`);
            console.log(`   🔄 批次内重复: ${duplicates.length} 篇`);
            console.log(`   🔍 关键词过滤: ${keywordFiltered.length} 篇`);

            // 6. 保存报告
            if (this.config.reporting.enabled) {
                await this.saveFilterReport(qualified, [...keywordFiltered, ...aiFiltered, ...duplicates]);
            }

            return {
                qualified,
                filtered: [...keywordFiltered, ...aiFiltered],
                duplicates,
                method: 'batch_ai'
            };

        } catch (error) {
            console.error(`   ❌ 批处理失败: ${error.message}`);
            console.log('   🔄 将降级为逐个调用模式');
            throw error; // 让调用者知道需要降级
        }
    }

    /**
     * 构建批处理 prompt
     */
    async _buildBatchPrompt(articles) {
        const articlesJson = JSON.stringify(articles, null, 2);

        // 使用 article_qualification_batch 任务的模板
        const template = `你是一个资深的新闻主编，负责为一个专注于【爱尔兰本土及中爱关系】的中文新闻门户筛选内容。你需要完成两个任务：

## 任务一：文章资格审查
对每篇文章判断是否符合以下标准：

### 筛选与排除标准：
1. **地域/主题相关性 (核心权重 80%)**:
   - ✅ **合格**：爱尔兰本土新闻、中爱关系新闻、含爱尔兰因素的国际新闻
   - ❌ **排除**：纯国际新闻（与爱尔兰/中国无关）、泛泛的全球趋势

2. **内容质量**:
   - ✅ **合格**：具备3个以上核心事实的严肃报道
   - ❌ **排除**：分类页、导航页、广告软文、碎片化内容

3. **讣告/死亡公告 (一票否决，但注意区分事故新闻)**:
   - ❌ **排除**：讣告、死亡公告、去世通知（含生平回顾、葬礼安排等）
   - ✅ **保留**：交通事故、犯罪等新闻事件中有人伤亡（这是正常新闻）

## 任务二：批次内去重
在所有合格文章中，检查是否有文章报道**同一事件**。

### 重复判断标准：
- ✅ **重复**：报道同一具体事件（相同时间、地点、人物、核心事件）
- ❌ **不重复**：相同主题但不同事件（如"A公司财报"vs"B公司财报"）

## 输入数据
你会收到一个 JSON 数组，每个元素包含 url, title, content。

## 输出格式
严格返回一个 JSON 对象：
{
  "results": [
    {
      "url": "文章URL",
      "qualified": true/false,
      "isDuplicate": true/false,
      "duplicateOf": "重复文章的URL或null",
      "reason": "判断理由",
      "score": 1-10
    }
  ]
}

只输出 JSON，不要 markdown 标记。

输入数据：
${articlesJson}`;

        return template;
    }

    /**
     * 解析批处理 AI 响应
     */
    _parseBatchResponse(response, originalArticles) {
        try {
            // 清理可能的 markdown 标记
            let cleanResponse = response.trim();
            if (cleanResponse.startsWith('```json')) {
                cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/```\s*$/, '');
            } else if (cleanResponse.startsWith('```')) {
                cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/```\s*$/, '');
            }

            const parsed = JSON.parse(cleanResponse);

            if (!parsed.results || !Array.isArray(parsed.results)) {
                throw new Error('响应格式错误：缺少 results 数组');
            }

            // 验证每个结果都包含必要字段
            return parsed.results.map(result => ({
                url: result.url,
                qualified: result.qualified === true,
                isDuplicate: result.isDuplicate === true,
                duplicateOf: result.duplicateOf || null,
                reason: result.reason || '',
                score: result.score || 5
            }));

        } catch (error) {
            console.error(`   ❌ 解析批处理响应失败: ${error.message}`);
            console.log(`   📝 原始响应: ${response.substring(0, 500)}...`);
            throw new Error(`批处理响应解析失败: ${error.message}`);
        }
    }
}

module.exports = NewsArticleFilter;
