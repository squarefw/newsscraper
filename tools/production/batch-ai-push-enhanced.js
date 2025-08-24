#!/usr/bin/env node

/**
 * NewsScraper 增强版批量AI处理与推送脚本
 * 支持自定义配置文件、动态分类管理、统一AI处理器
 */

const fs = require('fs');
const path = require('path');

// 引入配置加载器
const ConfigLoader = require('../../config/config-loader');

// 从命令行参数读取配置
const getConfig = () => {
  const args = process.argv.slice(2);
  let configPath = '../../config/config.development.json';
  let urlFile = 'examples/sample-urls.txt';

  if (args.length >= 1) {
    configPath = args[0];
  }
  if (args.length >= 2) {
    urlFile = args[1];
  }

  // 如果配置路径是相对路径，相对于项目根目录解析
  if (!path.isAbsolute(configPath)) {
    configPath = path.resolve(__dirname, '../../', configPath);
  }
  if (!path.isAbsolute(urlFile)) {
    urlFile = path.resolve(__dirname, '../../', urlFile);
  }

  return { configPath, urlFile };
};

// 动态加载配置文件
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

// 动态加载aiProcessor
const loadAIProcessor = () => {
  try {
    // 优先使用JavaScript版本（支持动态分类）
    const aiProcessor = require('../../utils/aiProcessor');
    console.log('✅ AI处理器加载成功 (JavaScript版本 - 支持动态分类)');
    return aiProcessor;
  } catch (error) {
    try {
      // 回退到TypeScript版本
      const aiProcessor = require('../../dist/aiProcessor');
      console.log('✅ AI处理器加载成功 (TypeScript版本 - 基础功能)');
      return aiProcessor;
    } catch (fallbackError) {
      throw new Error(`AI处理器加载失败: ${error.message}, 回退失败: ${fallbackError.message}`);
    }
  }
};

// 读取URL文件
const readUrlsFromFile = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`URL文件不存在: ${filePath}`);
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const urls = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.startsWith('http'));
    
    console.log(`📋 从 ${filePath} 读取到 ${urls.length} 个URL`);
    return urls;
  } catch (error) {
    throw new Error(`读取URL文件失败: ${error.message}`);
  }
};

// 从URL提取新闻内容
const extractNewsFromUrl = async (url) => {
  console.log(`📡 正在访问: ${url}`);
  
  try {
    const axios = require('axios');
    const cheerio = require('cheerio');
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 30000
    });

    const $ = cheerio.load(response.data);
    let title = '';
    let content = '';

    // 尝试多种选择器提取标题
    const titleSelectors = [
      'h1',
      '[data-testid="headline"]',
      '.story-headline',
      '.article-headline',
      '.headline',
      'title'
    ];

    for (const selector of titleSelectors) {
      title = $(selector).first().text().trim();
      if (title && title.length > 10) break;
    }

    // 尝试多种选择器提取正文
    const contentSelectors = [
      '[data-component="text-block"]',
      '.story-body__inner',
      '.article-body',
      '.content',
      '.post-content',
      'article p',
      '.entry-content p',
      'main p'
    ];

    for (const selector of contentSelectors) {
      const paragraphs = $(selector);
      if (paragraphs.length > 0) {
        content = paragraphs.map((i, el) => $(el).text().trim()).get().join('\n\n');
        if (content.length > 100) break;
      }
    }

    // 如果没有找到合适的内容，尝试通用方法
    if (!content || content.length < 100) {
      content = $('p').map((i, el) => $(el).text().trim()).get()
        .filter(text => text.length > 20)
        .slice(0, 10)
        .join('\n\n');
    }

    // 清理内容
    title = title.replace(/\s+/g, ' ').trim();
    content = content.replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();

    if (!title || !content) {
      throw new Error('无法提取有效的新闻内容');
    }

    console.log(`   ✅ 提取成功 - 标题: ${title.length}字符, 正文: ${content.length}字符`);
    return { title, content };
  } catch (error) {
    console.log(`   ❌ 提取失败: ${error.message}`);
    throw error;
  }
};

// 最终内容清理函数
const finalCleanContent = (content, type = 'content') => {
  if (!content || typeof content !== 'string') {
    return content;
  }

  let cleaned = content;

  // 移除编辑说明和处理痕迹
  const editingPatterns = [
    /以下是对.*?的重写版本.*?：/gi,
    /以下是.*?重写.*?结果.*?：/gi,
    /根据.*?要求.*?重写.*?：/gi,
    /^.*?重写.*?版本.*?：/gim,
    /^.*?改写.*?结果.*?：/gim,
    /^以下是.*?翻译.*?：/gim,
    /^翻译结果.*?：/gim,
    /^改写结果.*?：/gim,
    /^重写结果.*?：/gim,
    /^—+\s*$/gm,  // 移除单独的破折号行
    /^\s*—\s*$/gm  // 移除单独的破折号
  ];

  editingPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });

  if (type === 'title') {
    // 标题特殊处理
    cleaned = cleaned.replace(/^["'「」『』""'']*|["'「」『』""'']*$/g, '');
    cleaned = cleaned.replace(/[：:]\s*$/, '');
    // 确保标题长度合理
    if (cleaned.length > 25) {
      cleaned = cleaned.substring(0, 22) + '...';
    }
  }

  // 清理多余的空行和空白
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
  
  // 移除开头和结尾的多余符号
  cleaned = cleaned.replace(/^[：:\-—\s]+/, '').replace(/[：:\-—\s]+$/, '');

  return cleaned;
};

// 推送处理后的新闻到API或WordPress
const pushProcessedNews = async (processedData, originalUrl, config, pushMode) => {
  try {
    console.log(`📤 准备推送到${pushMode.toUpperCase()}: ${processedData.finalTitle}`);
    
    if (pushMode === 'wordpress') {
      // WordPress推送
      const axios = require('axios');
      
      // 构建WordPress文章对象，添加最终清理
      const cleanTitle = finalCleanContent(processedData.finalTitle || processedData.originalTitle, 'title');
      const cleanContent = finalCleanContent(processedData.finalContent || processedData.originalContent, 'content');
      
      const wpArticle = {
        title: cleanTitle,
        content: cleanContent,
        status: config.wordpress.defaultStatus || 'draft',
        categories: processedData.categoryId ? [processedData.categoryId] : (config.wordpress.defaultCategoryId ? [config.wordpress.defaultCategoryId] : [1]), // 使用AI选择的分类ID，默认为"Uncategorised"
        tags: processedData.tags || []
      };

      // 添加来源链接和发布日期
      if (config.wordpress.contentEnhancement?.addSourceLink) {
        const template = config.wordpress.contentEnhancement.sourceLinkTemplate || '\\n\\n**来源**: {url}';
        wpArticle.content += template.replace('{url}', originalUrl).replace('{title}', processedData.originalTitle);
      }

      if (config.wordpress.contentEnhancement?.addPublishDate) {
        const template = config.wordpress.contentEnhancement.publishDateTemplate || '\\n\\n*发布时间: {date}*';
        wpArticle.content += template.replace('{date}', new Date().toLocaleString('zh-CN'));
      }

      // 使用WordPress REST API推送
      const response = await axios.post(`${config.wordpress.baseUrl}/wp-json/wp/v2/posts`, wpArticle, {
        auth: {
          username: config.wordpress.username,
          password: config.wordpress.password
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log(`   ✅ WordPress推送成功 - 文章ID: ${response.data.id}`);
      
      return {
        success: true,
        response: response.data,
        articleId: response.data.id
      };
      
    } else {
      // API推送
      const { pushNewsArticle } = require('../../dist/apiClient');
      
      const newsArticle = {
        title: processedData.finalTitle || processedData.originalTitle,
        content: processedData.finalContent || processedData.originalContent,
        categoryId: processedData.categoryId || config.api?.defaultCategoryId || '550e8400-e29b-41d4-a716-446655440000',
        tags: processedData.tags || []
      };

      const response = await pushNewsArticle(newsArticle);
      console.log(`   ✅ API推送成功 - 响应ID: ${response.id || 'unknown'}`);
      
      return {
        success: true,
        response: response,
        articleId: response.id
      };
    }
    
  } catch (error) {
    console.log(`   ❌ ${pushMode.toUpperCase()}推送失败: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
};

// 显示帮助信息
const showHelp = () => {
  console.log(`
🚀 NewsScraper 增强版批量AI处理与推送脚本

用法:
  node batch-ai-push-enhanced.js [配置文件] [URL文件]

参数:
  配置文件    AI和API配置文件路径 (默认: config/config.development.json)
  URL文件     包含新闻URL的文本文件 (默认: examples/sample-urls.txt)

示例:
  # 使用默认配置
  node batch-ai-push-enhanced.js

  # 使用远程配置
  node batch-ai-push-enhanced.js config/config.remote-230.json examples/wordpress-test-urls.txt

  # 使用生产配置
  node batch-ai-push-enhanced.js config/config.production.json examples/production-urls.txt

功能特性:
  ✅ 支持自定义配置文件
  ✅ 统一的AI处理器 (支持动态分类)
  ✅ 多种AI引擎支持 (Ollama, OpenAI, Gemini等)
  ✅ 智能内容提取
  ✅ 自动分类和标签生成
  ✅ API推送功能
  ✅ 详细的处理报告

配置要求:
  - AI引擎配置 (api key, model等)
  - API服务器配置 (baseUrl, apiKey)
  - 处理任务列表定义
`);
};

// 主函数
async function main() {
  console.log('🚀 NewsScraper 增强版批量AI处理与推送脚本');
  console.log('=============================================\n');

  try {
    // 解析命令行参数
    const { configPath, urlFile } = getConfig();
    
    // 检查参数
    if (process.argv.includes('-h') || process.argv.includes('--help')) {
      showHelp();
      return;
    }

    // 加载配置
    const config = loadConfig(configPath);
    
    // 检查配置完整性
    if (!config.ai?.enabled) {
      throw new Error('AI功能未启用，请在配置文件中设置 ai.enabled: true');
    }
    
    // 检查API或WordPress配置
    const hasApiConfig = config.api?.enabled && config.api?.baseUrl && config.api?.apiKey;
    const hasWordPressConfig = config.wordpress?.enabled && config.wordpress?.baseUrl && config.wordpress?.username;
    
    if (!hasApiConfig && !hasWordPressConfig) {
      throw new Error('需要配置API或WordPress推送。请检查配置文件中的 api 或 wordpress 配置段');
    }
    
    const pushMode = hasWordPressConfig ? 'wordpress' : 'api';
    console.log(`📋 推送模式: ${pushMode.toUpperCase()}`);

    console.log('📋 配置信息:');
    console.log(`  AI引擎: ${config.ai.defaultEngine}`);
    
    if (pushMode === 'wordpress') {
      console.log(`  WordPress地址: ${config.wordpress.baseUrl}`);
      console.log(`  WordPress用户: ${config.wordpress.username}`);
      console.log(`  默认状态: ${config.wordpress.defaultStatus || 'draft'}`);
    } else {
      console.log(`  API地址: ${config.api.baseUrl}`);
      console.log(`  API密钥: ${config.api.apiKey ? '***已配置***' : '❌ 未配置'}`);
    }
    console.log(`  处理任务: ${config.ai.tasks.join(', ')}`);
    console.log();

    // 初始化推送客户端
    if (pushMode === 'wordpress') {
      console.log('🔗 初始化WordPress客户端...');
      // WordPress不需要特殊初始化，直接使用配置即可
      console.log('✅ WordPress配置验证成功\n');
    } else {
      console.log('🔗 初始化API客户端...');
      const { initApiClient } = require('../../dist/apiClient');
      await initApiClient(config, configPath);
      console.log('✅ API客户端初始化成功\n');
    }

    // 加载AI处理器
    console.log('🤖 加载AI处理器...');
    const aiProcessor = loadAIProcessor();
    
    // 创建多AI管理器 (支持任务级别的AI分工合作)
    console.log('🚀 创建多AI管理器...');
    const { MultiAIManager } = require('../../utils/multiAIManager');
    const multiAIManager = new MultiAIManager(config);
    console.log('✅ 多AI管理器创建成功');
    
    // 显示AI分工情况
    const stats = multiAIManager.getStats();
    console.log(`🎯 AI分工配置:`);
    console.log(`   默认引擎: ${stats.defaultEngine}`);
    console.log(`   可用引擎: ${stats.availableEngines.join(', ')}`);
    console.log(`   任务分配:`);
    for (const [task, engine] of Object.entries(stats.taskMapping)) {
      console.log(`     ${task} -> ${engine}`);
    }
    console.log();

    // 读取URL列表
    const urls = readUrlsFromFile(urlFile);
    if (urls.length === 0) {
      throw new Error('没有找到有效的URL');
    }

    console.log(`📝 准备处理 ${urls.length} 个URL\n`);

    // 批量处理
    const results = [];
    const startTime = Date.now();
    let successCount = 0;
    let pushSuccessCount = 0;

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`\n📄 处理 ${i + 1}/${urls.length}: ${url}`);
      console.log('─'.repeat(80));
      
      const urlStartTime = Date.now();
      
      try {
        // 提取新闻内容
        const originalContent = await extractNewsFromUrl(url);
        
        // AI处理（使用统一处理器）
        let aiProcessResult;
        console.log('🤖 开始AI处理...');
        
        try {
          if (aiProcessor.processNewsWithDynamicCategories) {
            // 使用动态分类版本
            console.log('   使用动态分类处理器');
            aiProcessResult = await aiProcessor.processNewsWithDynamicCategories(
              multiAIManager, 
              originalContent, 
              config.ai.tasks || ['translate', 'rewrite', 'summarize'], 
              config
            );
          } else if (aiProcessor.processNewsWithAI) {
            // 使用标准版本
            console.log('   使用标准AI处理器');
            aiProcessResult = await aiProcessor.processNewsWithAI(
              multiAIManager,
              originalContent,
              config.ai.tasks || ['translate', 'rewrite', 'summarize'],
              [], // wpCategories
              config // aiProcessorConfig
            );
          } else {
            throw new Error('AI处理器方法不可用');
          }
          
          console.log('   AI处理完成，结果类型:', typeof aiProcessResult);
          console.log('   结果包含的键:', aiProcessResult ? Object.keys(aiProcessResult) : 'undefined');
          
        } catch (aiError) {
          console.log(`   AI处理错误: ${aiError.message}`);
          throw new Error(`AI处理失败: ${aiError.message}`);
        }
        
        // 推送到API或WordPress
        const pushResult = await pushProcessedNews(aiProcessResult, url, config, pushMode);
        
        const urlDuration = Date.now() - urlStartTime;
        
        results.push({
          url,
          success: true,
          duration: urlDuration,
          aiProcessResult,
          pushResult
        });
        
        successCount++;
        if (pushResult.success) {
          pushSuccessCount++;
        }
        
        console.log(`✅ URL处理完成 (${urlDuration}ms) - 推送${pushResult.success ? '成功' : '失败'}`);
        
      } catch (error) {
        const urlDuration = Date.now() - urlStartTime;
        
        results.push({
          url,
          success: false,
          duration: urlDuration,
          error: error.message
        });
        
        console.log(`❌ URL处理失败: ${error.message} (${urlDuration}ms)`);
      }
      
      // 添加延迟避免请求过快
      if (i < urls.length - 1) {
        console.log('⏱️  等待3秒后继续...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    const totalDuration = Date.now() - startTime;

    // 显示最终结果
    console.log('\n' + '='.repeat(80));
    console.log('🎉 增强版批量处理完成！');
    console.log('='.repeat(80));
    console.log(`📊 处理统计:`);
    console.log(`   ✅ 成功处理: ${successCount}/${urls.length} (${((successCount/urls.length)*100).toFixed(1)}%)`);
    console.log(`   ❌ 处理失败: ${urls.length - successCount}/${urls.length}`);
    console.log(`📊 推送统计:`);
    console.log(`   ✅ 推送成功: ${pushSuccessCount}/${successCount} (${successCount > 0 ? ((pushSuccessCount/successCount)*100).toFixed(1) : 0}%)`);
    console.log(`   ❌ 推送失败: ${successCount - pushSuccessCount}/${successCount}`);
    console.log(`⏱️  总耗时: ${Math.round(totalDuration/1000)}秒`);
    console.log(`📈 平均处理时间: ${Math.round(totalDuration/urls.length/1000)}秒/URL`);

    // 显示推送成功的文章信息
    const successfulPushes = results.filter(r => r.success && r.pushResult?.success);
    if (successfulPushes.length > 0) {
      console.log(`\n📚 成功推送的文章:`);
      successfulPushes.forEach((result, index) => {
        const articleId = result.pushResult.response?.id || 'unknown';
        const title = result.aiProcessResult.finalTitle || result.aiProcessResult.originalTitle;
        console.log(`   ${index + 1}. ${title} (ID: ${articleId})`);
      });
    }

    // 显示失败的URL信息
    const failedUrls = results.filter(r => !r.success || !r.pushResult?.success);
    if (failedUrls.length > 0) {
      console.log(`\n❌ 处理失败的URL:`);
      failedUrls.forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.url}`);
        if (result.error) {
          console.log(`      错误: ${result.error}`);
        } else if (result.pushResult && !result.pushResult.success) {
          console.log(`      推送错误: ${result.pushResult.error}`);
        }
      });
    }

    console.log(`\n🔗 配置文件: ${configPath}`);
    console.log(`🔗 URL文件: ${urlFile}`);

  } catch (error) {
    console.error('❌ 增强版批量处理失败:', error.message);
    console.log('\n使用 -h 或 --help 查看帮助信息');
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, readUrlsFromFile, extractNewsFromUrl, pushProcessedNews };
