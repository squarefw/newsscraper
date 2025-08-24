#!/usr/bin/env node

/**
 * 新闻文章筛选器 - 调试工具
 * 专门用于调试新闻文章筛选功能
 * 
 * 使用方法:
 * node tools/debug/news-filter-tester.js [config.json] [urls-file.txt]
 * 
 * 功能:
 * 1. 测试AI筛选和规则筛选的效果
 * 2. 对比不同筛选方法的结果
 * 3. 输出详细的筛选分析报告
 * 4. 支持批量测试多个URL
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

// 导入筛选器
const NewsArticleFilter = require('../../utils/newsArticleFilter');
const { MultiAIManager } = require('../../utils/multiAIManager');

/**
 * 加载配置文件
 */
const loadConfig = (configPath) => {
  try {
    console.log(`📋 加载配置文件: ${configPath}`);
    if (!fs.existsSync(configPath)) {
      throw new Error(`配置文件不存在: ${configPath}`);
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    throw new Error(`配置文件加载失败: ${error.message}`);
  }
};

/**
 * 加载测试URL列表
 */
const loadTestUrls = (urlsFile) => {
  try {
    if (!fs.existsSync(urlsFile)) {
      throw new Error(`URL文件不存在: ${urlsFile}`);
    }
    
    const content = fs.readFileSync(urlsFile, 'utf8');
    const urls = content.split('\n')
      .map(line => line.trim())
      .filter(line => line && line.startsWith('http'));
    
    console.log(`📋 加载了 ${urls.length} 个测试URL`);
    return urls;
  } catch (error) {
    throw new Error(`URL文件加载失败: ${error.message}`);
  }
};

/**
 * 获取链接的详细内容信息
 */
const getLinkContentInfo = async (url, index, total) => {
  try {
    console.log(`📋 [${index + 1}/${total}] 获取内容: ${url.slice(0, 80)}...`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 15000,
      maxContentLength: 3000000  // 3MB
    });
    
    const $ = cheerio.load(response.data);
    
    // 提取标题
    let title = $('title').text().trim() ||
                $('h1').first().text().trim() ||
                $('meta[property="og:title"]').attr('content') ||
                '';
    
    // 提取描述
    let description = $('meta[name="description"]').attr('content') ||
                     $('meta[property="og:description"]').attr('content') ||
                     '';
    
    // 提取正文内容
    let content = '';
    $('script, style, nav, footer, header, aside, .advertisement, .ads').remove();
    
    const contentSelectors = [
      'article', '.article-content', '.content', '.post-content', 
      '.entry-content', 'main', '.main-content', '.story-content',
      '.article-body', '.post-body'
    ];
    
    for (const selector of contentSelectors) {
      if ($(selector).length > 0) {
        content = $(selector).text().trim();
        break;
      }
    }
    
    if (!content) {
      content = $('p').map((i, el) => $(el).text().trim()).get().join(' ');
    }
    
    content = content.replace(/\s+/g, ' ').substring(0, 3000);
    
    // 分析页面特征
    const features = {
      hasArticleTag: $('article').length > 0,
      hasDateTime: $('time, .date, .publish-date').length > 0,
      hasAuthor: $('.author, .byline, [rel="author"]').length > 0,
      paragraphCount: $('p').length,
      linkCount: $('a').length,
      imageCount: $('img').length,
      wordCount: content.split(' ').length,
      titleLength: title.length,
      hasNewsKeywords: /news|article|story|report/i.test(title + ' ' + description),
      pathDepth: url.split('/').length - 3
    };
    
    console.log(`   ✅ 成功 - 标题: ${title.slice(0, 50)}...`);
    console.log(`   📊 特征: 段落${features.paragraphCount} 字数${features.wordCount} 深度${features.pathDepth}`);
    
    return {
      url: url,
      title: title,
      description: description,
      content: content,
      features: features,
      success: true,
      responseTime: response.headers['x-response-time'] || 'unknown',
      statusCode: response.status
    };
    
  } catch (error) {
    console.log(`   ❌ 失败: ${error.message}`);
    return {
      url: url,
      title: '',
      description: '',
      content: '',
      features: {},
      success: false,
      error: error.message
    };
  }
};

/**
 * 执行筛选测试
 */
const runFilterTest = async (linkDataArray, config, method) => {
  try {
    console.log(`\n🔍 执行${method === 'ai' ? 'AI' : '规则'}筛选测试...`);
    
    const filterConfig = {
      ...config.discovery.articleFilter,
      method: method
    };
    
    // 初始化AI管理器（如果需要）
    let multiAIManager = null;
    if (method === 'ai') {
      multiAIManager = new MultiAIManager(config);
    }
    
    // 初始化筛选器
    const articleFilter = new NewsArticleFilter(multiAIManager, filterConfig);
    
    const startTime = Date.now();
    const filteredLinks = await articleFilter.filterNewsArticles(linkDataArray);
    const processingTime = Date.now() - startTime;
    
    const results = {
      method: method,
      totalInput: linkDataArray.length,
      totalOutput: filteredLinks.length,
      processingTime: processingTime,
      successRate: Math.round((filteredLinks.length / linkDataArray.length) * 100),
      filteredUrls: filteredLinks,
      rejectedUrls: linkDataArray
        .filter(item => !filteredLinks.includes(item.url))
        .map(item => item.url)
    };
    
    console.log(`   ✅ ${method}筛选完成: ${results.totalOutput}/${results.totalInput} (${results.successRate}%)`);
    console.log(`   ⏱️  处理时间: ${Math.round(processingTime / 1000)}秒`);
    
    return results;
    
  } catch (error) {
    console.error(`❌ ${method}筛选失败: ${error.message}`);
    return {
      method: method,
      error: error.message,
      totalInput: linkDataArray.length,
      totalOutput: 0,
      successRate: 0
    };
  }
};

/**
 * 生成筛选分析报告
 */
const generateFilterReport = (linkDataArray, aiResults, ruleResults) => {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalUrls: linkDataArray.length,
      successfullyAnalyzed: linkDataArray.filter(item => item.success).length,
      aiResults: {
        filtered: aiResults.totalOutput,
        successRate: aiResults.successRate,
        processingTime: aiResults.processingTime
      },
      ruleResults: {
        filtered: ruleResults.totalOutput,
        successRate: ruleResults.successRate,
        processingTime: ruleResults.processingTime
      }
    },
    urlAnalysis: linkDataArray.map(item => ({
      url: item.url,
      title: item.title,
      success: item.success,
      features: item.features,
      aiApproved: aiResults.filteredUrls?.includes(item.url),
      ruleApproved: ruleResults.filteredUrls?.includes(item.url),
      agreement: aiResults.filteredUrls?.includes(item.url) === ruleResults.filteredUrls?.includes(item.url)
    })),
    comparison: {
      bothApproved: 0,
      onlyAiApproved: 0,
      onlyRuleApproved: 0,
      bothRejected: 0,
      agreementRate: 0
    }
  };
  
  // 计算一致性分析
  report.urlAnalysis.forEach(item => {
    if (item.aiApproved && item.ruleApproved) {
      report.comparison.bothApproved++;
    } else if (item.aiApproved && !item.ruleApproved) {
      report.comparison.onlyAiApproved++;
    } else if (!item.aiApproved && item.ruleApproved) {
      report.comparison.onlyRuleApproved++;
    } else {
      report.comparison.bothRejected++;
    }
  });
  
  report.comparison.agreementRate = Math.round(
    ((report.comparison.bothApproved + report.comparison.bothRejected) / linkDataArray.length) * 100
  );
  
  return report;
};

/**
 * 保存筛选报告
 */
const saveFilterReport = (report) => {
  try {
    const outputPath = path.resolve(__dirname, '../../examples/filter-analysis-report.json');
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
    
    // 生成简化的文本报告
    const textReport = `新闻筛选分析报告
====================
生成时间: ${report.timestamp}

📊 总体统计:
- 总URL数量: ${report.summary.totalUrls}
- 成功分析: ${report.summary.successfullyAnalyzed}

🤖 AI筛选结果:
- 通过筛选: ${report.summary.aiResults.filtered} (${report.summary.aiResults.successRate}%)
- 处理时间: ${Math.round(report.summary.aiResults.processingTime / 1000)}秒

📏 规则筛选结果:
- 通过筛选: ${report.summary.ruleResults.filtered} (${report.summary.ruleResults.successRate}%)
- 处理时间: ${Math.round(report.summary.ruleResults.processingTime / 1000)}秒

🔄 方法对比:
- 两者都通过: ${report.comparison.bothApproved}
- 仅AI通过: ${report.comparison.onlyAiApproved}
- 仅规则通过: ${report.comparison.onlyRuleApproved}
- 两者都拒绝: ${report.comparison.bothRejected}
- 一致性: ${report.comparison.agreementRate}%

${report.urlAnalysis.map((item, i) => 
  `${i + 1}. ${item.success ? '✅' : '❌'} ${item.aiApproved ? '🤖' : '  '} ${item.ruleApproved ? '📏' : '  '} ${item.title || 'No Title'}`
).join('\n')}
`;
    
    const textOutputPath = outputPath.replace('.json', '.txt');
    fs.writeFileSync(textOutputPath, textReport, 'utf8');
    
    console.log(`\n💾 筛选报告已保存:`);
    console.log(`   详细报告: ${outputPath}`);
    console.log(`   文本报告: ${textOutputPath}`);
    
  } catch (error) {
    console.error(`❌ 保存报告失败: ${error.message}`);
  }
};

/**
 * 主函数
 */
async function main() {
  console.log('🚀 新闻文章筛选器调试工具');
  console.log('===============================\n');

  try {
    // 获取参数
    const configPath = process.argv[2] || path.resolve(__dirname, '../../config/config.remote-230.json');
    const urlsFile = process.argv[3] || path.resolve(__dirname, '../../examples/google-news-debug-results.txt');
    
    // 加载配置和测试URL
    const config = loadConfig(configPath);
    const testUrls = loadTestUrls(urlsFile);

    if (testUrls.length === 0) {
      console.log('🟡 没有找到测试URL，退出调试。');
      return;
    }

    console.log(`🎯 完整测试模式: 测试所有 ${testUrls.length} 个URL\n`);

    // 1. 获取所有URL的内容信息
    console.log('📋 第一步: 获取URL内容信息');
    console.log('─'.repeat(40));
    
    const linkDataArray = [];
    for (let i = 0; i < testUrls.length; i++) {
      const url = testUrls[i];
      const contentInfo = await getLinkContentInfo(url, i, testUrls.length);
      linkDataArray.push(contentInfo);
      
      // 避免请求过于频繁
      if (i < testUrls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successfulAnalysis = linkDataArray.filter(item => item.success).length;
    console.log(`\n✅ 内容分析完成: ${successfulAnalysis}/${testUrls.length} 成功`);

    // 2. 执行AI筛选测试
    console.log('\n🤖 第二步: AI筛选测试');
    console.log('─'.repeat(40));
    const aiResults = await runFilterTest(linkDataArray, config, 'ai');

    // 3. 执行规则筛选测试
    console.log('\n📏 第三步: 规则筛选测试');
    console.log('─'.repeat(40));
    const ruleResults = await runFilterTest(linkDataArray, config, 'rule');

    // 4. 生成对比分析报告
    console.log('\n📊 第四步: 生成分析报告');
    console.log('─'.repeat(40));
    const report = generateFilterReport(linkDataArray, aiResults, ruleResults);
    saveFilterReport(report);

    // 显示总结
    console.log(`\n📈 筛选测试总结:`);
    console.log(`   - AI筛选: ${aiResults.totalOutput}/${aiResults.totalInput} (${aiResults.successRate}%)`);
    console.log(`   - 规则筛选: ${ruleResults.totalOutput}/${ruleResults.totalInput} (${ruleResults.successRate}%)`);
    console.log(`   - 方法一致性: ${report.comparison.agreementRate}%`);
    console.log(`   - AI处理时间: ${Math.round(aiResults.processingTime / 1000)}秒`);
    console.log(`   - 规则处理时间: ${Math.round(ruleResults.processingTime / 1000)}秒`);

  } catch (error) {
    console.error('\n❌ 筛选调试工具运行失败:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
