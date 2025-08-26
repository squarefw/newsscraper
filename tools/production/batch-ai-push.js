#!/usr/bin/env node

/**
 * NewsScraper 批量AI处理与推送脚本
 * 使用智能WordPress连接器，支持REST API和XML-RPC自动切换
 */

const fs = require('fs');
const path = require('path');

// 引入配置加载器和WordPress连接器
const ConfigLoader = require('../../config/config-loader');
const WordPressConnector = require('../../utils/wordpressConnector');

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
    let imageUrl = null;

    // 1. 优先从Meta标签提取图片
    imageUrl = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');

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
      'article',
      '.entry-content',
      'main'
    ];
    
    let $contentElement = null;
    for (const selector of contentSelectors) {
      const $el = $(selector);
      if ($el.length > 0) {
        $contentElement = $el.first();
        const paragraphs = $contentElement.find('p');
        if (paragraphs.length > 0) {
            content = paragraphs.map((i, el) => $(el).text().trim()).get().join('\n\n');
            if (content.length > 100) break;
        }
      }
    }

    // 2. 如果Meta标签没有图片，从内容中提取第一张
    if (!imageUrl && $contentElement) {
      const firstImg = $contentElement.find('img').first();
      if (firstImg.length) {
        imageUrl = firstImg.attr('src');
      }
    }

    // 如果没有找到合适的内容，尝试通用方法
    if (!content || content.length < 100) {
      content = $('p').map((i, el) => $(el).text().trim())
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

    // 3. 确保图片URL是绝对路径
    if (imageUrl) {
      try {
        const absoluteUrl = new URL(imageUrl, url).href;
        imageUrl = absoluteUrl;
        console.log(`   🖼️ 发现图片: ${imageUrl}`);
      } catch (e) {
        console.log(`   ⚠️ 无效的图片URL: ${imageUrl}`);
        imageUrl = null;
      }
    } else {
      console.log('   🟡 未找到合适的图片');
    }

    console.log(`   ✅ 提取成功 - 标题: ${title.length}字符, 正文: ${content.length}字符`);
    console.log(`   📋 标题内容: "${title}"`);
    console.log(`   📋 正文开头: "${content.substring(0, 200)}..."`);
    return { title, content, imageUrl };
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
    /^\s*—\s*$/gm  // 秼除单独的破折号
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

// 使用新WordPress连接器推送文章
const pushToWordPressWithConnector = async (processedData, originalUrl, config, wpConnector, featuredMediaId = null) => {
  try {
    console.log(`📤 准备推送到WordPress: ${processedData.finalTitle || processedData.originalTitle}`);
    
    // 构建文章数据
    const cleanTitle = finalCleanContent(processedData.finalTitle || processedData.originalTitle, 'title');
    const cleanContent = finalCleanContent(processedData.finalContent || processedData.originalContent, 'content');
    
    // 添加来源链接和发布日期
    let enhancedContent = cleanContent;
    
    if (config.wordpress.contentEnhancement?.addSourceLink) {
      const template = config.wordpress.contentEnhancement.sourceLinkTemplate || '\n\n**来源**: {url}';
      enhancedContent += template.replace('{url}', originalUrl).replace('{title}', processedData.originalTitle || cleanTitle);
    }

    if (config.wordpress.contentEnhancement?.addPublishDate) {
      const template = config.wordpress.contentEnhancement.publishDateTemplate || '\n\n*发布时间: {date}*';
      enhancedContent += template.replace('{date}', new Date().toLocaleString('zh-CN'));
    }
    
    const postData = {
      title: cleanTitle,
      content: enhancedContent,
      status: config.wordpress.defaultStatus || 'draft',
      categories: processedData.categoryId ? [processedData.categoryId] : [config.wordpress.defaultCategory || 'Technology'],
      excerpt: processedData.summary || '',
      featuredMediaId: featuredMediaId  // 添加特色图片媒体ID
    };

    console.log(`   📂 分类设置: categoryId=${processedData.categoryId}, categories=${JSON.stringify(postData.categories)}`);

    // 使用WordPress连接器发布文章
    const result = await wpConnector.publishPost(postData);
    
    if (result.success) {
      console.log(`   ✅ WordPress推送成功!`);
      console.log(`   🆔 文章ID: ${result.postId}`);
      console.log(`   🔗 文章链接: ${result.link}`);
      console.log(`   📝 状态: ${result.status}`);
      console.log(`   🔧 使用方法: ${result.method.toUpperCase()}`);
      if (featuredMediaId) {
        console.log(`   🖼️ 特色图片: 已设置 (媒体ID: ${featuredMediaId})`);
        
        // 验证特色图片设置
        try {
          const verification = await wordpressConnector.verifyFeaturedImage(result.postId);
          if (verification.success && verification.hasImage) {
            console.log(`   ✅ 特色图片验证成功`);
          } else {
            console.log(`   ⚠️  特色图片验证失败或未设置`);
          }
        } catch (error) {
          console.log(`   ⚠️  特色图片验证出错: ${error.message}`);
        }
      }
      
      return {
        success: true,
        response: result,
        articleId: result.postId,
        link: result.link,
        method: result.method
      };
    } else {
      throw new Error('WordPress连接器返回失败状态');
    }
    
  } catch (error) {
    console.log(`   ❌ WordPress推送失败: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
};

// 主函数
async function main() {
  console.log('🚀 NewsScraper 批量AI处理与推送脚本');
  console.log('======================================\n');

  try {
    // 解析命令行参数
    const { configPath, urlFile } = getConfig();

    // 加载配置
    const config = loadConfig(configPath);
    
    // 检查配置完整性
    if (!config.ai?.enabled) {
      throw new Error('AI功能未启用，请在配置文件中设置 ai.enabled: true');
    }
    
    if (!config.wordpress?.enabled || !config.wordpress?.baseUrl || !config.wordpress?.username) {
      throw new Error('WordPress配置不完整。请检查配置文件中的 wordpress 配置段');
    }

    console.log('📋 配置信息:');
    console.log(`  AI引擎: ${config.ai.defaultEngine}`);
    console.log(`  WordPress地址: ${config.wordpress.baseUrl}`);
    console.log(`  WordPress用户: ${config.wordpress.username}`);
    console.log(`  默认状态: ${config.wordpress.defaultStatus || 'draft'}`);
    console.log(`  处理任务: ${config.ai.tasks.join(', ')}`);
    console.log();

    // 初始化WordPress连接器
    console.log('🔗 初始化WordPress连接器...');
    const wpConnector = new WordPressConnector({
      baseUrl: config.wordpress.baseUrl,
      username: config.wordpress.username,
      password: config.wordpress.password
    });
    
    // 检测最佳连接方法
    const connectionMethod = await wpConnector.detectBestMethod();
    console.log(`✅ WordPress连接器初始化成功，使用方法: ${connectionMethod.toUpperCase()}\n`);

    // 加载AI处理器
    console.log('🤖 加载AI处理器...');
    const aiProcessor = loadAIProcessor();
    
    // 创建多AI管理器
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

    // 获取WordPress分类列表（用于AI分类选择）
    console.log('📂 获取WordPress分类列表...');
    const wpCategories = await wpConnector.getCategories();
    console.log(`✅ 获取到 ${wpCategories.length} 个分类: ${wpCategories.map(c => c.name).slice(0, 5).join(', ')}${wpCategories.length > 5 ? '...' : ''}`);
    console.log('📋 完整分类列表:');
    wpCategories.forEach(cat => {
      console.log(`   - ${cat.name} (ID: ${cat.id})`);
    });
    console.log('');

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
          console.log('   使用AI处理器（含WordPress分类约束）');
          aiProcessResult = await aiProcessor.processNewsWithAI(
            multiAIManager, 
            originalContent, 
            config.ai.tasks || ['translate', 'rewrite', 'categorize'], 
            wpCategories, // 使用已经获取的WordPress分类
            config
          );
          
          console.log('   ✅ AI处理完成');
          
        } catch (aiError) {
          console.log(`   ❌ AI处理错误: ${aiError.message}`);
          throw new Error(`AI处理失败: ${aiError.message}`);
        }

        // 图片上传处理
        let featuredMediaId = null;
        if (originalContent.imageUrl) {
          console.log('🖼️ 开始处理特色图片...');
          try {
            const uploadResult = await wpConnector.uploadImageFromUrl(originalContent.imageUrl);
            if (uploadResult.success) {
              featuredMediaId = uploadResult.mediaId;
              console.log(`   ✅ 特色图片设置成功，媒体ID: ${featuredMediaId}`);
            } else {
              console.log(`   ⚠️ 图片上传失败: ${uploadResult.error}`);
            }
          } catch (imageError) {
            console.log(`   ⚠️ 图片处理出错: ${imageError.message}`);
          }
        } else {
          console.log('   🟡 本文无特色图片');
        }
        
        // 使用新WordPress连接器推送
        const pushResult = await pushToWordPressWithConnector(aiProcessResult, url, config, wpConnector, featuredMediaId);
        
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
    console.log('🎉 批量处理完成！');
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
        const articleId = result.pushResult.articleId || 'unknown';
        const title = result.aiProcessResult.finalTitle || result.aiProcessResult.originalTitle;
        const method = result.pushResult.method || 'unknown';
        console.log(`   ${index + 1}. ${title} (ID: ${articleId}, 方法: ${method.toUpperCase()})`);
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
    console.log(`🔧 连接方法: ${connectionMethod.toUpperCase()}`);

  } catch (error) {
    console.error('❌ 批量处理失败:', error.message);
    console.log('\n💡 故障排除建议:');
    console.log('1. 检查WordPress配置是否正确');
    console.log('2. 确认网络连接正常');
    console.log('3. 验证AI引擎配置和API密钥');
    console.log('4. 查看详细错误信息');
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, readUrlsFromFile, extractNewsFromUrl };
