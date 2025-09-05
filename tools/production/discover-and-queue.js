#!/usr/bin/env node

/**
 * NewsScraper V4 - 新闻源AI自动发现与智能去重系统
 * 
 * 用法:
 *   node discover-and-queue.js [配置文件路径]
 * 
 * 例子:
 *   node discover-and-queue.js                                    # 使用默认配置
 *   node discover-and-queue.js config/config.remote-aliyun.json  # 使用阿里云配置
 *   node discover-and-queue.js config/config.remote-230.json     # 使用230配置
 * 
 * 职责:
 * 1. 监控配置文件中指定的新闻源。
 * 2. 使用AI发现与关键词相关的新文章链接。
 * 3. 使用AI对新文章进行去重检查。
 * 4. 将唯一的、新的文章URL写入队列文件。
 * 5. (可选) 自动触发 `batch-ai-push.js` 进行后续处理。
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { exec } = require('child_process');

// --- 动态加载模块 ---
const ConfigLoader = require('../../config/config-loader');
const { MultiAIManager } = require('../../utils/multiAIManager');
const { findRelevantLinks, isGoogleNews } = require('../../utils/sourceAnalyzer_new'); // 使用增强版
const { isDuplicate } = require('../../utils/wordpressDeduplicator');
const { resolveGoogleNewsUrls } = require('../../utils/puppeteerResolver_enhanced');
const NewsArticleFilter = require('../../utils/newsArticleFilter');
const ExecutionStateManager = require('../../utils/executionStateManager');

/**
 * 获取配置文件路径
 */
const getConfigPath = () => {
  const args = process.argv.slice(2);
  let configPath = 'config/config.remote-230.json'; // 默认配置
  
  if (args.length >= 1) {
    configPath = args[0];
  }
  
  // 如果配置路径是相对路径，相对于项目根目录解析
  if (!path.isAbsolute(configPath)) {
    configPath = path.resolve(__dirname, '../../', configPath);
  }
  
  return configPath;
};

/**
 * 加载配置文件
 */
const loadConfig = (configPath) => {
  try {
    console.log(`📋 加载配置文件: ${configPath}`);
    if (!fs.existsSync(configPath)) {
      throw new Error(`配置文件不存在: ${configPath}`);
    }
    
    // 使用ConfigLoader自动注入API密钥
    const configLoader = new ConfigLoader();
    const environment = configLoader.inferEnvironment(configPath);
    const config = configLoader.loadConfig(configPath, environment);
    
    console.log(`✅ 配置加载成功，环境: ${environment}`);
    return config;
  } catch (error) {
    throw new Error(`配置文件加载失败: ${error.message}`);
  }
};

/**
 * 加载新闻源目标配置
 */
const loadTargets = (targetsPath) => {
  try {
    console.log(`📋 加载新闻源配置: ${targetsPath}`);
    if (!fs.existsSync(targetsPath)) {
      throw new Error(`新闻源配置文件不存在: ${targetsPath}`);
    }
    const targets = JSON.parse(fs.readFileSync(targetsPath, 'utf8'));
    
    // 只返回启用的新闻源
    const enabledTargets = targets.filter(target => target.enabled !== false);
    console.log(`✅ 成功加载 ${enabledTargets.length} 个启用的新闻源`);
    
    return enabledTargets;
  } catch (error) {
    throw new Error(`新闻源配置加载失败: ${error.message}`);
  }
};

/**
 * 获取网页HTML内容 - 增强版
 */
const getPageHtml = async (url) => {
  try {
    console.log(`📡 正在访问新闻源: ${url}`);
    
    const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; NewsScraperBot/1.0; +http://example.com/bot)' };
    
    const response = await axios.get(url, {
      headers: headers,
      timeout: 20000 // 增加超时时间
    });
    
    console.log(`   ✅ 成功获取页面内容，大小: ${response.data.length} 字符`);
    return response.data;
  } catch (error) {
    console.error(`❌ 访问新闻源失败: ${url}`, error.message);
    return null;
  }
};

/**
 * 获取链接的基本内容信息（用于AI筛选）
 */
const getLinkContentInfo = async (url) => {
  try {
    const axios = require('axios');
    const cheerio = require('cheerio');
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsScraperBot/1.0)'
      },
      timeout: 10000,
      maxContentLength: 2000000  // 增加到2MB
    });
    
    const $ = cheerio.load(response.data);
    
    // 提取标题
    let title = $('title').text().trim() ||
                $('h1').first().text().trim() ||
                $('meta[property="og:title"]').attr('content') ||
                '';
    
    // 提取正文内容
    let content = '';
    $('script, style, nav, footer, header, aside').remove();
    
    const contentSelectors = [
      'article', '.article-content', '.content', '.post-content', 
      '.entry-content', 'main', '.main-content'
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
    
    content = content.replace(/\s+/g, ' ').substring(0, 2000);
    
    return {
      url: url,
      title: title,
      content: content,
      success: true
    };
  } catch (error) {
    console.log(`     ⚠️ 无法获取内容: ${error.message}`);
    return {
      url: url,
      title: '',
      content: '',
      success: false
    };
  }
};

/**
 * 主函数
 */
async function main() {
  console.log('🚀 启动新闻发现与去重系统 V4');
  console.log('=============================================\n');

  try {
    // 1. 加载配置
    const configPath = getConfigPath();
    const config = loadConfig(configPath);

    console.log(`📋 使用配置文件: ${configPath}`);

    if (!config.discovery?.enabled) {
      console.log('🟡 新闻发现功能未在配置中启用，脚本退出。');
      return;
    }

    // 1.5. 初始化执行状态管理器
    const stateManager = new ExecutionStateManager(config);
    const executionSummary = await stateManager.getExecutionSummary();
    
    // 显示执行状态摘要
    console.log(`📊 执行状态摘要:`);
    console.log(`   - 状态模式: ${executionSummary.stateMode}`);
    console.log(`   - 历史运行次数: ${executionSummary.totalRuns}`);
    console.log(`   - 上次成功运行: ${executionSummary.lastExecutionTime?.toISOString()}`);
    console.log(`   - 距离上次运行: ${executionSummary.minutesSinceLastRun} 分钟`);
    console.log(`   - 累计发现URL: ${executionSummary.totalDiscoveredUrls}`);
    console.log(`   - 累计推送文章: ${executionSummary.totalPushedArticles}`);

    // 记录发现运行开始时间
    const discoveryStartTime = new Date();
    console.log(`\n🕐 记录发现运行开始时间: ${discoveryStartTime.toISOString()}`);

    // 2. 加载新闻源目标配置
    const targetsPath = path.resolve(__dirname, '../../', config.discovery.targetsFile || 'config/targets.json');
    const targets = loadTargets(targetsPath);

    if (targets.length === 0) {
      console.log('🟡 没有启用的新闻源，脚本退出。');
      return;
    }

    // 3. 初始化AI管理器
    console.log('🤖 初始化AI管理器...');
    const multiAIManager = new MultiAIManager(config);
    console.log('✅ AI管理器准备就绪。\n');

    const allNewLinks = new Set();

    // 获取基准时间（用于增量抓取）
    const baselineTime = await stateManager.getLastExecutionTime();

    // 4. 遍历所有新闻源
    for (const source of targets) {
      console.log(`\n🔍 开始处理新闻源: ${source.name}`);
      console.log('─'.repeat(50));

      const pageHtml = await getPageHtml(source.url);
      if (!pageHtml) continue;

      // 5. AI发现相关链接
      const allFoundItems = await findRelevantLinks(pageHtml, source.keywords, source.url, multiAIManager);
      console.log(`   Analyzer found ${allFoundItems.length} potential articles.`);

      // 5.1. 应用增量抓取过滤
      console.log(`   📅 应用增量抓取过滤，基准时间: ${baselineTime.toISOString()}`);
      let relevantItems = [];
      for (const item of allFoundItems) {
        const shouldProcess = await stateManager.shouldProcessArticle(item.date, baselineTime);
        if (shouldProcess) {
          relevantItems.push(item);
          if (item.date) {
            console.log(`   ✅ 文章通过时间过滤: ${item.date.toISOString()}...`);
          } else {
            console.log(`   ⚠️ 文章无日期信息，保留: ${item.url?.substring(0, 50)}...`);
          }
        } else {
          console.log(`   ❌ 文章时间过旧，跳过: ${item.date?.toISOString()}...`);
        }
      }

      // 额外的Google News日期过滤（保持向后兼容）
      if (isGoogleNews(source.url)) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0); // Start of yesterday

        const beforeGoogleFilter = relevantItems.length;
        relevantItems = relevantItems.filter(item => {
          return !item.date || item.date >= yesterday;
        });
        
        console.log(`   📰 Google News 时间过滤: ${beforeGoogleFilter} -> ${relevantItems.length} 篇文章 (基准: ${baselineTime.toISOString()})`);
      }
      
      let relevantLinks = relevantItems.map(item => item.url);

      if (relevantLinks.length === 0) continue;

      // 处理所有相关链接，不做数量限制
      console.log(`   Processing all ${relevantLinks.length} relevant links.`);

      // 5.5. 如果是Google News，使用新的解码器解析链接
      let processedLinks = relevantLinks;
      if (isGoogleNews(source.url)) {
        console.log(`   Detected Google News source, decoding ${relevantLinks.length} links...`);
        
        if (relevantLinks.length > 0) {
          // 传递URL解析器配置
          const resolverOptions = config.discovery.urlResolver || {};
          processedLinks = await resolveGoogleNewsUrls(relevantLinks, resolverOptions);
          console.log(`   ✅ Decoding finished, resolved to ${processedLinks.length} final URLs.`);
          
          // 调试信息：检查解码后的URL样本
          console.log(`   🔍 解码结果样本:`);
          processedLinks.slice(0, 3).forEach((url, i) => {
            console.log(`      ${i + 1}. ${url.substring(0, 100)}...`);
          });
        }
      }

      // 5.8. AI筛选新闻文章链接
      let articleLinks = processedLinks;
      if (config.discovery.articleFilter?.enabled && processedLinks.length > 0) {
        const filterConfig = config.discovery.articleFilter;
        console.log(`\n🔍 开始AI筛选新闻文章链接 (${processedLinks.length}个链接)`);
        
        // 获取链接内容信息
        const linkDataArray = [];
        const maxLinks = Math.min(processedLinks.length, filterConfig.maxLinksToAnalyze || 10);
        for (let i = 0; i < maxLinks; i++) {
          const url = processedLinks[i];
          console.log(`   📋 获取内容 ${i + 1}/${maxLinks}: ${url.slice(0, 60)}...`);
          const contentInfo = await getLinkContentInfo(url);
          linkDataArray.push(contentInfo);
        }
        
        // 初始化文章筛选器 - 使用完整配置
        const articleFilter = new NewsArticleFilter(multiAIManager, filterConfig);
        
        // 执行筛选
        articleLinks = await articleFilter.filterNewsArticles(linkDataArray);
        console.log(`   ✅ 筛选完成: ${articleLinks.length}个新闻文章链接保留\n`);
      } else {
        console.log('   📝 新闻文章筛选功能未启用，保留所有链接');
      }

      // 6. AI去重检查
      if (config.discovery.deduplication?.enabled) {
        let newLinkCount = 0;
        for (const link of articleLinks) {
          process.stdout.write(`   - Checking link: ${link.slice(0, 70)}... `);
          const duplicate = await isDuplicate(link, multiAIManager, config);
          if (duplicate) {
            process.stdout.write('[Duplicate]\n');
          } else {
            process.stdout.write('[New]\n');
            allNewLinks.add(link);
            newLinkCount++;
          }
        }
        console.log(`   Found ${newLinkCount} confirmed new links.`);
      } else {
        console.log('   Deduplication is disabled, all links will be treated as new.');
        articleLinks.forEach(link => allNewLinks.add(link));
      }
    }

    // 7. 将新链接写入队列文件
    const finalLinks = Array.from(allNewLinks);
    if (finalLinks.length > 0) {
      const outputPath = path.resolve(__dirname, '../../', config.discovery.outputUrlFile);
      fs.writeFileSync(outputPath, finalLinks.join('\n'), 'utf8');
      console.log(`\n✅ Successfully wrote ${finalLinks.length} new links to: ${outputPath}`);

      // 7.5. 更新执行状态
      await stateManager.updateExecutionState(discoveryStartTime);

      // 8. (可选) 触发后续处理脚本 - 使用修复版脚本
      console.log('\n🚀 Triggering downstream processing with fixed WordPress connector...');
      const { spawn } = require('child_process');
      const command = 'node';
      const args = [
        path.resolve(__dirname, 'batch-ai-push.js'),
        configPath,
        outputPath
      ];

      console.log(`   Executing: ${command} ${args.join(' ')}`);
      
      const child = spawn(command, args);

      child.stdout.on('data', (data) => {
        process.stdout.write(data);
      });

      child.stderr.on('data', (data) => {
        process.stderr.write(data);
      });

      child.on('close', (code) => {
        if (code !== 0) {
          console.error(`\n❌ Downstream script finished with exit code: ${code}`);
        } else {
          console.log('\n✅ Downstream script completed successfully.');
        }
      });

    } else {
      console.log('\n🏁 No new articles found in this run.');
      
      // 即使没有新文章，也更新执行状态
      await stateManager.updateExecutionState(discoveryStartTime);
    }

  } catch (error) {
    console.error('\n❌ A critical error occurred in the system:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}