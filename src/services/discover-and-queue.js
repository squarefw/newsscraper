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
 *   node       // 5.7. Google News URL解码
      let processedLinks = relevantLinks;
      if (is        // 初始化文章筛选器 - 使用完整配置，并强制使用taskEngines中的配置
        const filterConfig = {
          ...config.discovery.articleFilter,
          aiEngine: config.ai.taskEngines.article_filter || config.discovery.articleFilter.aiEngine
        };
        const articleFilter = new NewsArticleFilter(multiAIManager, filterConfig);
        
        // 执行筛选
        articleLinks = await articleFilter.filterNewsArticles(linkDataArray);eNews(source.url)) {
        console.log(`   Detected Google News source, checking ${relevantLinks.length} links...`);
        
        if (relevantLinks.length > 0) {
          // 检查是否需要解码：如果URL中包含google.com，说明是编码URL，需要解码
          const urlsToCheck = relevantLinks.map(linkObj => 
            typeof linkObj === 'string' ? linkObj : linkObj.url
          ).filter(url => url);
          
          const needsDecoding = urlsToCheck.some(url => url.includes('google.com'));
          
          console.log(`   Sample URLs: ${urlsToCheck.slice(0, 2).join(', ')}`);
          console.log(`   Needs decoding: ${needsDecoding}`);
          
          if (needsDecoding) {
            console.log(`   Found Google News encoded URLs, decoding...`);
            const resolverOptions = config.discovery.urlResolver || {};
            processedLinks = await resolveGoogleNewsUrls(relevantLinks, resolverOptions);
            console.log(`   ✅ Decoding finished, resolved to ${processedLinks.length} final URLs.`);
          } else {
            console.log(`   URLs already decoded, skipping decoding step.`);
          }
        }
 *   node discover-and-queue.js config/config.remote-aliyun.json     # 使用阿里云配置
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
const ConfigLoader = require('../config/loader');
const { MultiAIManager } = require('../ai/multiAIManager');
const { findRelevantLinks, isGoogleNews } = require('../ai/sourceAnalyzer_new'); // 使用增强版
const { isDuplicate } = require('../wordpress/wordpressDeduplicator');
const GoogleNewsDecoder = require('../utils/googleNewsDecoder');
const { resolveGoogleNewsUrls } = require('../browser/puppeteerResolver_enhanced');
const NewsArticleFilter = require('../article/newsArticleFilter');
const { extractNewsFromUrl, isNoiseTitle } = require('../article/newsExtractor');
const ExecutionStateManager = require('../common/executionStateManager');

/**
 * 获取配置文件路径和运行模式
 */
const parseArgs = () => {
  const args = process.argv.slice(2);
  let configPath = 'config/config.remote-aliyun.json'; // 默认配置
  let testMode = false;
  
  // 解析参数
  for (const arg of args) {
    if (arg === '--test') {
      testMode = true;
    } else if (!arg.startsWith('--')) {
      configPath = arg;
    }
  }
  
  // 如果配置路径是相对路径，相对于项目根目录解析
  if (!path.isAbsolute(configPath)) {
    configPath = path.resolve(__dirname, '../../', configPath);
  }
  
  return { configPath, testMode };
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
    const info = await extractNewsFromUrl(url);
    
    // 如果是噪音标题（如简报页），直接标记为失败
    if (isNoiseTitle(info.title)) {
      console.log(`     🚫 识别到噪音标题: "${info.title}"，跳过分析`);
      return { url, title: info.title, content: '', success: false };
    }

    return {
      url: url,
      title: info.title,
      content: info.content,
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
    // 1. 解析参数并加载配置
    const { configPath, testMode } = parseArgs();
    const config = loadConfig(configPath);

    console.log(`📋 使用配置文件: ${configPath}`);
    if (testMode) {
      console.log(`🧪 测试模式：仅处理5个URL`);
    }

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
      const allFoundItems = await findRelevantLinks(pageHtml, source.keywords, source.url, multiAIManager, { testMode });
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

      // 测试模式：限制处理的URL数量
      if (testMode && relevantLinks.length > 5) {
        console.log(`   🧪 测试模式：从 ${relevantLinks.length} 个链接中选择前 5 个进行处理`);
        relevantLinks = relevantLinks.slice(0, 5);
      }

      // 处理所有相关链接，不做数量限制
      console.log(`   Processing ${testMode ? 'first ' : 'all '}${relevantLinks.length} relevant links.`);

      // 5.5. 如果是Google News，使用新的解码器解析链接
      let processedLinks = relevantLinks;
      if (isGoogleNews(source.url)) {
        console.log(`   Detected Google News source, checking ${relevantLinks.length} links...`);
        
        if (relevantLinks.length > 0) {
          // 检查是否需要解码：如果URL中包含news.google.com/rss/articles，说明是编码URL，需要解码
          const needsDecoding = relevantLinks.some(url => {
            return url && (
              url.includes('news.google.com/rss/articles') || 
              url.includes('news.google.com/articles') ||
              url.includes('news.google.com/topics/read') ||
              url.includes('news.google.com/publications')
            );
          });
          
          if (needsDecoding) {
            console.log(`   Found Google News encoded URLs, decoding...`);
            const decoder = new GoogleNewsDecoder();
            const decodeResults = await decoder.decodeBatch(relevantLinks);
            
            processedLinks = [];
            const failedLinks = [];
            for (let i = 0; i < decodeResults.length; i++) {
                if (decodeResults[i].status && decodeResults[i].url) {
                    processedLinks.push(decodeResults[i].url);
                } else {
                    failedLinks.push(relevantLinks[i]);
                }
            }
            
            if (failedLinks.length > 0) {
                console.log(`   ⚠️ Python bridge fallback failed for ${failedLinks.length} URLs, using Puppeteer...`);
                const fallbackResults = await resolveGoogleNewsUrls(failedLinks, config.discovery.urlResolver || {});
                processedLinks.push(...fallbackResults);
            }
            
            console.log(`   ✅ Decoding finished, resolved to ${processedLinks.length} final URLs.`);
          } else {
            console.log(`   URLs already decoded, skipping decoding step.`);
            console.log(`   Sample URLs: ${relevantLinks.slice(0, 2).map(url => url.substring(0, 60) + '...').join(', ')}`);
          }
        }
      }

      // 5.8. 批处理 AI 筛选（资格审查 + 批次内去重）
      let articleLinks = processedLinks;
      if (config.discovery.articleFilter?.enabled && processedLinks.length > 0) {
        const filterConfig = config.discovery.articleFilter;
        console.log(`\n🔍 开始筛选新闻文章链接 (${processedLinks.length}个链接)`);

        // 获取所有链接的完整内容（用于批处理）
        const linkDataArray = [];
        let maxLinks = Math.min(processedLinks.length, filterConfig.maxLinksToAnalyze || 10);

        // 测试模式：进一步限制
        if (testMode) {
          maxLinks = Math.min(maxLinks, 5);
          console.log(`   🧪 测试模式：限制为 ${maxLinks} 个链接`);
        }

        console.log(`   📥 抓取 ${maxLinks} 篇文章的完整内容...`);
        for (let i = 0; i < maxLinks; i++) {
          const url = processedLinks[i];
          process.stdout.write(`   [${i + 1}/${maxLinks}] 抓取中... `);
          try {
            // 使用 extractNewsFromUrl 获取完整内容（10000 字符）
            const { extractNewsFromUrl } = require('../article/newsExtractor');
            const articleData = await extractNewsFromUrl(url);
            linkDataArray.push({
              url: url,
              title: articleData.title || '',
              content: articleData.content || '' // 完整内容（最多 8000 字符）
            });
            console.log(`✅ ${articleData.title?.substring(0, 40) || '(无标题)'}...`);
          } catch (err) {
            console.log(`❌ 抓取失败: ${err.message}`);
            // 抓取失败的也加入，但内容为空，让 AI 判断
            linkDataArray.push({
              url: url,
              title: '',
              content: ''
            });
          }
        }

        // 初始化文章筛选器
        const articleFilter = new NewsArticleFilter(multiAIManager, filterConfig);

        // 尝试批处理模式
        try {
          console.log(`\n🚀 使用批处理模式（1次 AI 调用完成资格审查+去重）...`);
          const batchResult = await articleFilter.filterNewsArticlesBatch(linkDataArray);
          articleLinks = batchResult.qualified;
          console.log(`   ✅ 批处理完成: ${articleLinks.length} 篇文章通过筛选\n`);
        } catch (batchError) {
          // 批处理失败，降级为逐个调用
          console.log(`\n⚠️ 批处理失败，降级为逐个调用模式...`);
          articleLinks = await articleFilter.filterNewsArticles(linkDataArray);
          console.log(`   ✅ 逐个筛选完成: ${articleLinks.length} 篇文章通过资格审查`);

          // 逐个模式下需要单独做去重
          if (config.discovery.deduplication?.enabled && articleLinks.length > 0) {
            console.log(`\n🔍 开始逐个去重检查 (${articleLinks.length} 篇文章)...`);
            const deduplicatedLinks = [];
            for (const link of articleLinks) {
              process.stdout.write(`   - 检查: ${link.slice(0, 60)}... `);
              const duplicate = await isDuplicate(link, multiAIManager, config);
              if (duplicate) {
                process.stdout.write('[重复]\n');
              } else {
                process.stdout.write('[新文章]\n');
                deduplicatedLinks.push(link);
              }
            }
            articleLinks = deduplicatedLinks;
            console.log(`   ✅ 去重完成: ${articleLinks.length} 篇新文章\n`);
          }
        }
      } else {
        console.log('   📝 新闻文章筛选功能未启用，保留所有链接');
        // 即使不筛选，也需要去重
        if (config.discovery.deduplication?.enabled && articleLinks.length > 0) {
          console.log(`\n🔍 开始去重检查 (${articleLinks.length} 篇文章)...`);
          const deduplicatedLinks = [];
          for (const link of articleLinks) {
            process.stdout.write(`   - 检查: ${link.slice(0, 60)}... `);
            const duplicate = await isDuplicate(link, multiAIManager, config);
            if (duplicate) {
              process.stdout.write('[重复]\n');
            } else {
              process.stdout.write('[新文章]\n');
              deduplicatedLinks.push(link);
            }
          }
          articleLinks = deduplicatedLinks;
          console.log(`   ✅ 去重完成: ${articleLinks.length} 篇新文章\n`);
        }
      }

      // 将通过筛选的文章添加到 allNewLinks
      articleLinks.forEach(link => allNewLinks.add(link));
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