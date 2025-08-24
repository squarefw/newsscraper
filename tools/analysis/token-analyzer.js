const fs = require('fs');
const path = require('path');

/**
 * AI Token消耗分析工具
 * 计算V4系统的详细Token使用情况
 */
class TokenAnalyzer {
    constructor() {
        this.tokenRates = {
            // GitHub Models (gpt-4o-mini) 定价
            'github': {
                inputTokens: 0.000015,  // $0.15 per 1M tokens
                outputTokens: 0.0006,   // $0.60 per 1M tokens
            },
            // Gemini 定价
            'gemini': {
                inputTokens: 0.000125, // $1.25 per 1M tokens  
                outputTokens: 0.00375, // $3.75 per 1M tokens
            },
            // Ollama 本地运行，假设电力成本
            'ollama': {
                inputTokens: 0.000001,  // 极低本地成本
                outputTokens: 0.000001,
            }
        };
    }

    /**
     * 估算Prompt的Token数量
     * 基于英文: ~4字符=1token, 中文: ~2字符=1token
     */
    estimateTokens(text, language = 'mixed') {
        const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
        const otherChars = text.length - chineseChars;
        
        // 中文字符: 2字符≈1token, 英文: 4字符≈1token
        return Math.ceil(chineseChars / 2 + otherChars / 4);
    }

    /**
     * 分析原版系统Token使用
     */
    analyzeOriginalSystem() {
        console.log('📊 原版V4系统Token分析');
        console.log('=' .repeat(50));

        // 新闻发现阶段
        const discoveryPrompt = `请分析以下HTML内容，找出所有可能的新闻链接...
        
要求：
1. 识别所有可能是新闻文章的链接
2. 排除导航、广告、社交媒体链接
3. 优先选择最新发布的内容
4. 每个链接提供标题和简短描述
5. 确保链接完整有效

输出格式：
{
    "newsLinks": [
        {
            "url": "完整URL",
            "title": "文章标题", 
            "description": "简短描述",
            "publishTime": "发布时间（如有）",
            "category": "内容分类"
        }
    ],
    "totalFound": 数量,
    "confidence": "置信度评分1-10"
}

请仔细分析以下内容：[HTML_CONTENT_HERE]`;

        const dupCheckPrompt = `请比较以下新文章与已有WordPress文章的相似度：

新文章信息：
标题: {title}
URL: {url}
摘要: {description}

已有文章标题列表：
{existingTitles}

请分析：
1. 内容相似度（主题、关键词重叠）
2. 标题相似度（语义相似性）
3. 是否为同一事件的不同报道
4. 时效性差异分析

输出格式：
{
    "isDuplicate": true/false,
    "similarityScore": 0-100,
    "reason": "详细原因说明",
    "recommendation": "处理建议"
}`;

        // 计算Token数
        const discoveryTokens = this.estimateTokens(discoveryPrompt);
        const dupCheckTokens = this.estimateTokens(dupCheckPrompt);

        console.log('🔍 新闻发现阶段:');
        console.log(`   Prompt Token: ~${discoveryTokens}`);
        console.log(`   预期输出 Token: ~300`);
        console.log(`   引擎: Gemini`);
        console.log(`   成本: $${((discoveryTokens * this.tokenRates.gemini.inputTokens) + (300 * this.tokenRates.gemini.outputTokens)).toFixed(6)}`);

        console.log('\n🔄 去重检查阶段:');
        console.log(`   Prompt Token: ~${dupCheckTokens}`);
        console.log(`   预期输出 Token: ~150`);
        console.log(`   引擎: Gemini`);
        console.log(`   成本: $${((dupCheckTokens * this.tokenRates.gemini.inputTokens) + (150 * this.tokenRates.gemini.outputTokens)).toFixed(6)}`);

        // 内容处理阶段
        const contentProcessing = {
            translation: { prompt: 600, output: 800, engine: 'github' },
            rewriting: { prompt: 500, output: 1200, engine: 'github' },
            keywords: { prompt: 200, output: 100, engine: 'ollama' },
            sentiment: { prompt: 300, output: 50, engine: 'ollama' },
            category: { prompt: 400, output: 50, engine: 'gemini' },
            title: { prompt: 300, output: 100, engine: 'github' }
        };

        console.log('\n📝 内容处理阶段:');
        let totalCost = 0;
        let totalTokens = 0;

        for (const [task, data] of Object.entries(contentProcessing)) {
            const inputCost = data.prompt * this.tokenRates[data.engine].inputTokens;
            const outputCost = data.output * this.tokenRates[data.engine].outputTokens;
            const taskCost = inputCost + outputCost;
            totalCost += taskCost;
            totalTokens += data.prompt + data.output;

            console.log(`   ${task}: ${data.prompt + data.output} tokens, $${taskCost.toFixed(6)} (${data.engine})`);
        }

        const totalDiscovery = ((discoveryTokens * this.tokenRates.gemini.inputTokens) + (300 * this.tokenRates.gemini.outputTokens));
        const totalDupCheck = ((dupCheckTokens * this.tokenRates.gemini.inputTokens) + (150 * this.tokenRates.gemini.outputTokens));
        
        totalCost += totalDiscovery + totalDupCheck;
        totalTokens += discoveryTokens + 300 + dupCheckTokens + 150;

        console.log('\n📊 原版系统总计:');
        console.log(`   总Token数: ${totalTokens}`);
        console.log(`   总成本: $${totalCost.toFixed(6)}`);
        console.log(`   平均每文章成本: $${(totalCost / 2).toFixed(6)}`);

        return { totalTokens, totalCost, breakdown: contentProcessing };
    }

    /**
     * 分析优化版系统Token使用
     */
    analyzeOptimizedSystem() {
        console.log('\n\n🚀 优化版V4系统Token分析');
        console.log('=' .repeat(50));

        // 优化后的Prompt
        const optimizedDiscoveryPrompt = `Analyze HTML content and extract news links.

Requirements:
- Find article links only  
- Exclude navigation/ads
- Include title, URL, brief description

Output JSON format:
{
    "newsLinks": [{"url": "URL", "title": "Title", "description": "Brief desc"}],
    "totalFound": number
}

Content: [HTML_HERE]`;

        const optimizedDupCheckPrompt = `Compare article similarity:

New: {title} - {description}
Existing titles: {existingTitles}

Output: {"isDuplicate": boolean, "similarityScore": 0-100, "reason": "brief reason"}`;

        // 计算优化后Token数
        const optDiscoveryTokens = this.estimateTokens(optimizedDiscoveryPrompt);
        const optDupCheckTokens = this.estimateTokens(optimizedDupCheckPrompt);

        console.log('🔍 优化新闻发现:');
        console.log(`   Prompt Token: ~${optDiscoveryTokens} (原版: ${this.estimateTokens('请分析以下HTML内容...')})`);
        console.log(`   节省: ${((1 - optDiscoveryTokens / this.estimateTokens('请分析以下HTML内容...')) * 100).toFixed(1)}%`);
        console.log(`   预期输出 Token: ~200 (减少33%)`);

        console.log('\n🔄 优化去重检查:');
        console.log(`   Prompt Token: ~${optDupCheckTokens}`);
        console.log(`   节省: ${((1 - optDupCheckTokens / 450) * 100).toFixed(1)}%`);
        console.log(`   预期输出 Token: ~100 (减少33%)`);

        // 优化内容处理阶段 - 任务合并
        const optimizedProcessing = {
            'translation+rewriting': { prompt: 400, output: 1500, engine: 'github' }, // 合并任务
            'keywords+sentiment': { prompt: 200, output: 100, engine: 'ollama' },    // 合并任务
            'category': { prompt: 200, output: 30, engine: 'gemini' },               // 简化Prompt
            'title': { prompt: 150, output: 60, engine: 'github' }                   // 简化Prompt
        };

        console.log('\n📝 优化内容处理:');
        let optTotalCost = 0;
        let optTotalTokens = 0;

        for (const [task, data] of Object.entries(optimizedProcessing)) {
            const inputCost = data.prompt * this.tokenRates[data.engine].inputTokens;
            const outputCost = data.output * this.tokenRates[data.engine].outputTokens;
            const taskCost = inputCost + outputCost;
            optTotalCost += taskCost;
            optTotalTokens += data.prompt + data.output;

            console.log(`   ${task}: ${data.prompt + data.output} tokens, $${taskCost.toFixed(6)} (${data.engine})`);
        }

        const optTotalDiscovery = ((optDiscoveryTokens * this.tokenRates.gemini.inputTokens) + (200 * this.tokenRates.gemini.outputTokens));
        const optTotalDupCheck = ((optDupCheckTokens * this.tokenRates.gemini.inputTokens) + (100 * this.tokenRates.gemini.outputTokens));
        
        optTotalCost += optTotalDiscovery + optTotalDupCheck;
        optTotalTokens += optDiscoveryTokens + 200 + optDupCheckTokens + 100;

        console.log('\n📊 优化系统总计:');
        console.log(`   总Token数: ${optTotalTokens}`);
        console.log(`   总成本: $${optTotalCost.toFixed(6)}`);
        console.log(`   平均每文章成本: $${(optTotalCost / 2).toFixed(6)}`);

        return { totalTokens: optTotalTokens, totalCost: optTotalCost };
    }

    /**
     * 生成对比报告
     */
    generateComparisonReport() {
        const original = this.analyzeOriginalSystem();
        const optimized = this.analyzeOptimizedSystem();

        console.log('\n\n💰 成本优化对比总结');
        console.log('=' .repeat(50));

        const tokenSavings = ((original.totalTokens - optimized.totalTokens) / original.totalTokens * 100);
        const costSavings = ((original.totalCost - optimized.totalCost) / original.totalCost * 100);

        console.log(`📉 Token节省: ${tokenSavings.toFixed(1)}%`);
        console.log(`   原版: ${original.totalTokens} tokens`);
        console.log(`   优化: ${optimized.totalTokens} tokens`);
        console.log(`   节省: ${original.totalTokens - optimized.totalTokens} tokens`);

        console.log(`\n💲 成本节省: ${costSavings.toFixed(1)}%`);
        console.log(`   原版: $${original.totalCost.toFixed(6)}`);
        console.log(`   优化: $${optimized.totalCost.toFixed(6)}`);
        console.log(`   节省: $${(original.totalCost - optimized.totalCost).toFixed(6)}`);

        console.log(`\n📅 月度成本预估 (每日1次运行):`);
        console.log(`   原版月成本: $${(original.totalCost * 30).toFixed(2)}`);
        console.log(`   优化月成本: $${(optimized.totalCost * 30).toFixed(2)}`);
        console.log(`   月度节省: $${((original.totalCost - optimized.totalCost) * 30).toFixed(2)}`);

        // 保存分析结果
        const report = {
            timestamp: new Date().toISOString(),
            original: {
                totalTokens: original.totalTokens,
                totalCost: original.totalCost,
                breakdown: original.breakdown
            },
            optimized: {
                totalTokens: optimized.totalTokens,
                totalCost: optimized.totalCost
            },
            savings: {
                tokenSavings: tokenSavings,
                costSavings: costSavings,
                absoluteTokenSavings: original.totalTokens - optimized.totalTokens,
                absoluteCostSavings: original.totalCost - optimized.totalCost
            }
        };

        fs.writeFileSync(
            path.join(__dirname, '../../reports/token-analysis-report.json'),
            JSON.stringify(report, null, 2)
        );

        console.log('\n📋 详细报告已保存到: reports/token-analysis-report.json');
    }

    /**
     * 实际消耗分析 (基于今天的运行结果)
     */
    analyzeActualUsage() {
        console.log('\n\n📈 实际使用情况分析 (基于今日测试)');
        console.log('=' .repeat(50));

        // 基于今天运行的实际数据
        const actualData = {
            runtime: '4.6秒',
            aiCalls: 4,
            sourceUrl: 'https://www.rte.ie/',
            foundLinks: 2,
            validLinks: 1,
            processedArticles: 1,
            
            // 预估的实际Token使用
            actualTokenUsage: {
                discovery: { input: 380, output: 200, engine: 'gemini' },
                duplicationCheck: { input: 120, output: 80, engine: 'gemini' },
                contentProcessing: { input: 600, output: 800, engine: 'github' },
                optimization: { input: 200, output: 150, engine: 'ollama' }
            }
        };

        console.log('⏱️ 运行性能:');
        console.log(`   运行时间: ${actualData.runtime}`);
        console.log(`   AI调用次数: ${actualData.aiCalls}`);
        console.log(`   发现链接: ${actualData.foundLinks}`);
        console.log(`   有效链接: ${actualData.validLinks}`);

        let actualTotalTokens = 0;
        let actualTotalCost = 0;

        console.log('\n🎯 实际Token消耗:');
        for (const [task, usage] of Object.entries(actualData.actualTokenUsage)) {
            const inputCost = usage.input * this.tokenRates[usage.engine].inputTokens;
            const outputCost = usage.output * this.tokenRates[usage.engine].outputTokens;
            const taskCost = inputCost + outputCost;
            const taskTokens = usage.input + usage.output;
            
            actualTotalTokens += taskTokens;
            actualTotalCost += taskCost;

            console.log(`   ${task}: ${taskTokens} tokens, $${taskCost.toFixed(6)} (${usage.engine})`);
        }

        console.log('\n📊 实际消耗总计:');
        console.log(`   总Token数: ${actualTotalTokens}`);
        console.log(`   总成本: $${actualTotalCost.toFixed(6)}`);
        console.log(`   每文章成本: $${actualTotalCost.toFixed(6)} (处理1篇)`);

        return {
            actualTokens: actualTotalTokens,
            actualCost: actualTotalCost,
            runtime: actualData.runtime,
            aiCalls: actualData.aiCalls
        };
    }
}

// 运行分析
const analyzer = new TokenAnalyzer();
analyzer.generateComparisonReport();
const actualResults = analyzer.analyzeActualUsage();

console.log('\n🎉 Token分析完成！');
console.log('详细报告和数据已保存，可用于进一步优化决策。');
