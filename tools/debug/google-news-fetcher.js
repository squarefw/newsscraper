#!/usr/bin/env node

/**
 * Google News 抓取器 - 调试工具
 * 专门用于调试Google News URL的抓取功能
 * 
 * 使用方法:
 * node tools/debug/google-news-fetcher.js [config.json]
 * 
 * 功能:
 * 1. 从Google News源获取原始编码URL
 * 2. 使用简化的Puppeteer解析器解码URL
 * 3. 输出详细的调试信息
 * 4. 保存结果到文件供进一步分析
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 导入增强的解析器（使用redirect方法）
const { resolveGoogleNewsUrls } = require('../../utils/puppeteerResolver_enhanced');
const { findRelevantLinks, isGoogleNews } = require('../../utils/sourceAnalyzer_new');
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
 * 加载Google News源
 */
const loadGoogleNewsSources = (targetsPath) => {
  try {
    console.log(`📋 加载新闻源配置: ${targetsPath}`);
    if (!fs.existsSync(targetsPath)) {
      throw new Error(`新闻源配置文件不存在: ${targetsPath}`);
    }
    const targets = JSON.parse(fs.readFileSync(targetsPath, 'utf8'));
    
    // 只返回启用的Google News源
    const googleNewsSources = targets.filter(target => 
      target.enabled !== false && 
      (target.type === 'google-news' || isGoogleNews(target.url))
    );
    
    console.log(`✅ 找到 ${googleNewsSources.length} 个Google News源`);
    return googleNewsSources;
  } catch (error) {
    throw new Error(`新闻源配置加载失败: ${error.message}`);
  }
};

/**
 * 获取网页HTML内容
 */
const getPageHtml = async (url) => {
  try {
    console.log(`📡 访问新闻源: ${url}`);
    
    const headers = { 
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    
    const response = await axios.get(url, {
      headers: headers,
      timeout: 20000
    });
    
    console.log(`   ✅ 成功获取页面内容，大小: ${response.data.length} 字符`);
    return response.data;
  } catch (error) {
    console.error(`   ❌ 访问新闻源失败: ${url}`, error.message);
    return null;
  }
};

/**
 * 保存调试结果
 */
const saveDebugResults = (results, filename) => {
  try {
    const outputPath = path.resolve(__dirname, '../../examples', filename);
    
    // 创建详细的调试报告
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalSources: results.length,
        totalOriginalLinks: results.reduce((sum, r) => sum + r.originalLinks.length, 0),
        totalResolvedLinks: results.reduce((sum, r) => sum + r.resolvedLinks.length, 0),
        averageSuccessRate: results.length > 0 ? 
          Math.round(results.reduce((sum, r) => sum + r.successRate, 0) / results.length) : 0
      },
      sources: results
    };
    
    // 保存JSON格式的详细报告
    fs.writeFileSync(outputPath.replace('.txt', '.json'), JSON.stringify(report, null, 2), 'utf8');
    
    // 保存简单的URL列表
    const allResolvedLinks = results.flatMap(r => r.resolvedLinks);
    fs.writeFileSync(outputPath, allResolvedLinks.join('\n'), 'utf8');
    
    console.log(`\n💾 调试结果已保存:`);
    console.log(`   详细报告: ${outputPath.replace('.txt', '.json')}`);
    console.log(`   URL列表: ${outputPath}`);
    
    return report.summary;
  } catch (error) {
    console.error(`❌ 保存结果失败: ${error.message}`);
    return null;
  }
};

/**
 * 主函数
 */
async function main() {
  console.log('🚀 Google News 抓取器调试工具');
  console.log('=====================================\n');

  try {
    // 获取配置文件路径
    const configPath = process.argv[2] || path.resolve(__dirname, '../../config/config.remote-230.json');
    const config = loadConfig(configPath);

    // 加载Google News源
    const targetsPath = path.resolve(__dirname, '../../', config.discovery?.targetsFile || 'config/targets.json');
    const googleNewsSources = loadGoogleNewsSources(targetsPath);

    if (googleNewsSources.length === 0) {
      console.log('🟡 没有找到启用的Google News源，退出调试。');
      return;
    }

    // 初始化AI管理器（用于链接发现）
    console.log('🤖 初始化AI管理器...');
    const multiAIManager = new MultiAIManager(config);
    console.log('✅ AI管理器准备就绪。\n');

    const debugResults = [];

    // 逐个处理Google News源
    for (let i = 0; i < googleNewsSources.length; i++) {
      const source = googleNewsSources[i];
      console.log(`\n🔍 [${i + 1}/${googleNewsSources.length}] 调试新闻源: ${source.name}`);
      console.log('─'.repeat(60));

      const startTime = Date.now();
      const result = {
        name: source.name,
        url: source.url,
        keywords: source.keywords,
        originalLinks: [],
        resolvedLinks: [],
        errors: [],
        processingTime: 0,
        successRate: 0
      };

      try {
        // 1. 获取页面内容
        const pageHtml = await getPageHtml(source.url);
        if (!pageHtml) {
          result.errors.push('无法获取页面内容');
          debugResults.push(result);
          continue;
        }

        // 2. AI发现相关链接
        console.log(`🤖 使用AI发现相关链接...`);
        const allFoundItems = await findRelevantLinks(pageHtml, source.keywords, source.url, multiAIManager);
        console.log(`   发现 ${allFoundItems.length} 个潜在文章链接`);

        // 过滤日期（只要昨天以来的）
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const relevantItems = allFoundItems.filter(item => {
          return item.date && item.date >= yesterday;
        });
        console.log(`   按日期过滤后保留 ${relevantItems.length} 个链接`);

        result.originalLinks = relevantItems.map(item => item.url);

        if (result.originalLinks.length === 0) {
          result.errors.push('未发现任何相关链接');
          debugResults.push(result);
          continue;
        }

        // 处理所有发现的链接，不做限制
        const linksToDebug = result.originalLinks;
        console.log(`   处理所有 ${linksToDebug.length} 个链接`);

        // 3. 使用简化解析器解码URL
        console.log(`🔄 使用简化解析器解码URL...`);
        const resolverOptions = {
          timeout: 30000,
          concurrency: 1 // 调试时使用单线程
        };
        
        result.resolvedLinks = await resolveGoogleNewsUrls(linksToDebug, resolverOptions);
        result.successRate = linksToDebug.length > 0 ? 
          Math.round((result.resolvedLinks.length / linksToDebug.length) * 100) : 0;

        console.log(`✅ 解码完成: ${result.resolvedLinks.length}/${linksToDebug.length} (${result.successRate}%)`);

      } catch (error) {
        console.error(`❌ 处理失败: ${error.message}`);
        result.errors.push(error.message);
      }

      result.processingTime = Date.now() - startTime;
      debugResults.push(result);

      console.log(`⏱️  处理时间: ${Math.round(result.processingTime / 1000)}秒`);
    }

    // 保存调试结果
    const summary = saveDebugResults(debugResults, 'google-news-debug-results.txt');
    
    if (summary) {
      console.log(`\n📊 调试汇总:`);
      console.log(`   - 总共处理: ${summary.totalSources} 个新闻源`);
      console.log(`   - 发现原始链接: ${summary.totalOriginalLinks} 个`);
      console.log(`   - 成功解码链接: ${summary.totalResolvedLinks} 个`);
      console.log(`   - 平均成功率: ${summary.averageSuccessRate}%`);
    }

  } catch (error) {
    console.error('\n❌ 调试工具运行失败:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
