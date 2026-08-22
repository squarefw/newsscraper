#!/usr/bin/env node

/**
 * NewsScraper 批量AI处理与推送脚本
 * 使用智能WordPress连接器，支持REST API和XML-RPC自动切换
 */

const fs = require('fs');
const path = require('path');

// 引入配置加载器和WordPress连接器
const ConfigLoader = require('../config/loader');
const WordPressConnector = require('../wordpress/wordpressConnector');
const { recordProcessedArticle } = require('../wordpress/wordpressDeduplicator');
const { extractNewsFromUrl } = require('../article/newsExtractor');


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
    const aiProcessor = require('../ai/aiProcessor');
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

// 从URL文件中移除指定的URL
const removeUrlFromFile = (filePath, urlToRemove) => {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️ URL文件不存在: ${filePath}`);
      return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // 过滤掉要删除的URL，保留注释和其他内容
    const filteredLines = lines.filter(line => {
      const trimmedLine = line.trim();
      return trimmedLine !== urlToRemove;
    });
    
    // 写回文件
    fs.writeFileSync(filePath, filteredLines.join('\n'));
    console.log(`🗑️ 已从队列文件中移除URL: ${urlToRemove.substring(0, 50)}...`);
  } catch (error) {
    console.log(`⚠️ 移除URL失败: ${error.message}`);
  }
};

// 已移除内部 extractNewsFromUrl，改用外部导入版本

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
    // 标题保持完整，不截断 - WordPress标题字段限制255字符
    // 仅当标题异常超长时（>200字符）才做保护性截断，避免发布失败
    if (cleaned.length > 200) {
      cleaned = cleaned.substring(0, 197) + '...';
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
    
    // 无分类时发布为 draft 待人工审核（AI判断不属于任何分类）
    const hasCategory = !!processedData.categoryId;
    const postStatus = hasCategory ? (config.wordpress.defaultStatus || 'publish') : 'draft';

    const postData = {
      title: cleanTitle,
      content: enhancedContent,
      status: postStatus,
      categories: hasCategory ? [processedData.categoryId] : [],
      excerpt: processedData.summary || '',
      featuredMediaId: featuredMediaId  // 添加特色图片媒体ID
    };

    console.log(`   📂 分类设置: categoryId=${processedData.categoryId}, categories=${JSON.stringify(postData.categories)}, 状态=${postStatus}${hasCategory ? '' : ' (无分类→draft待审)'}`);

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
          const verification = await wpConnector.verifyFeaturedImage(result.postId);
          if (verification.success && verification.hasImage) {
            console.log(`   ✅ 特色图片验证成功`);
          } else {
            console.log(`   ⚠️  特色图片验证失败或未设置`);
          }
        } catch (error) {
          console.log(`   ⚠️  特色图片验证出错: ${error.message}`);
        }
      }
      
      try {
        recordProcessedArticle({
          title: cleanTitle,
          url: result.link,
          sourceUrl: originalUrl
        });
      } catch (cacheError) {
        console.log(`   ⚠️ 去重缓存更新失败: ${cacheError.message}`);
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

    // 获取WordPress分类列表
    console.log('📂 获取WordPress分类列表...');
    const wpCategories = await wpConnector.getCategories();
    console.log(`✅ 获取到 ${wpCategories.length} 个分类: ${wpCategories.map(c => c.name).slice(0, 5).join(', ')}${wpCategories.length > 5 ? '...' : ''}`);
    console.log('📋 完整分类列表:');
    wpCategories.forEach(cat => {
      console.log(`   - ${cat.name} (ID: ${cat.id})`);
    });
    console.log('');

    // 加载AI处理器
    console.log('🤖 加载AI处理器...');
    const aiProcessor = loadAIProcessor();
    
    // 创建多AI管理器
    console.log('🚀 创建多AI管理器...');
    const { MultiAIManager } = require('../ai/multiAIManager');
    const multiAIManager = new MultiAIManager(config);
    await multiAIManager.initialize();
    console.log('✅ 多AI管理器初始化成功');
    
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

    // ========== 批处理模式 ==========
    console.log('🚀 使用批处理模式（2次 AI 调用完成所有文章的翻译+重写+分类）\n');

    // 步骤 1: 提取所有文章内容
    console.log('📥 步骤 1/4: 提取所有文章内容...');
    const articlesData = [];
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      process.stdout.write(`   [${i + 1}/${urls.length}] ${url.substring(0, 50)}... `);
      try {
        const content = await extractNewsFromUrl(url);
        articlesData.push({
          url,
          title: content.title || '',
          content: content.content || '',
          imageUrl: content.imageUrl || null
        });
        console.log(`✅ ${content.title?.substring(0, 30) || '(无标题)'}...`);
      } catch (err) {
        console.log(`❌ 提取失败: ${err.message}`);
      }
    }
    console.log(`   ✅ 成功提取 ${articlesData.length}/${urls.length} 篇文章\n`);

    if (articlesData.length === 0) {
      console.log('⚠️ 没有成功提取任何文章，退出');
      return;
    }

    // 步骤 2: 批处理翻译
    console.log('🌐 步骤 2/4: 批处理翻译...');
    let translatedArticles = [];
    let useBatchMode = true;

    try {
      translatedArticles = await aiProcessor.translateArticlesBatch(multiAIManager, articlesData);
      console.log(`   ✅ 翻译完成: ${translatedArticles.length} 篇文章\n`);
    } catch (batchError) {
      console.log(`   ❌ 批处理翻译失败: ${batchError.message}`);
      console.log('   🔄 降级为逐个处理模式\n');
      useBatchMode = false;
    }

    // 步骤 3: 批处理重写+分类
    let processedArticles = [];

    if (useBatchMode) {
      console.log('✍️  步骤 3/4: 批处理重写+分类...');
      try {
        // 准备输入：翻译后的内容 + 原始英文标题
        const rewriteInput = translatedArticles.map((translated, index) => ({
          url: translated.url,
          translatedTitle: translated.translatedTitle,
          translatedContent: translated.translatedContent,
          originalTitle: articlesData[index]?.title || ''
        }));

        processedArticles = await aiProcessor.rewriteAndCategorizeBatch(multiAIManager, rewriteInput);
        console.log(`   ✅ 重写+分类完成: ${processedArticles.length} 篇文章\n`);
      } catch (batchError) {
        console.log(`   ❌ 批处理重写+分类失败: ${batchError.message}`);
        console.log('   🔄 降级为逐个处理模式\n');
        useBatchMode = false;
      }
    }

    // 如果批处理失败，降级为逐个处理
    if (!useBatchMode) {
      console.log('🔄 降级模式: 逐个处理文章...');
      processedArticles = [];

      for (const article of articlesData) {
        try {
          const essentialTasks = (config.ai.tasks || ['unified_translate_rewrite', 'categorize'])
            .filter(t => !['article_filter', 'deduplication', 'article_qualification'].includes(t));

          const result = await aiProcessor.processNewsWithAI(
            multiAIManager,
            { title: article.title, content: article.content },
            essentialTasks,
            wpCategories,
            config
          );

          processedArticles.push({
            url: article.url,
            rewrittenTitle: result.finalTitle,
            rewrittenContent: result.finalContent,
            category: result.category,
            categoryId: result.categoryId,
            imageUrl: article.imageUrl
          });
        } catch (err) {
          console.log(`   ❌ 处理失败: ${article.url} - ${err.message}`);
        }
      }
      console.log(`   ✅ 逐个处理完成: ${processedArticles.length} 篇文章\n`);
    }

    // 步骤 3.5: 将分类名称映射为 WordPress 分类ID（批处理模式只返回分类名称）
    console.log('🏷️  映射文章分类到 WordPress 分类ID...');
    for (const article of processedArticles) {
      if (!article.categoryId && article.category && typeof aiProcessor.validateAndGetCategoryId === 'function') {
        try {
          article.categoryId = await aiProcessor.validateAndGetCategoryId(
            article.category,
            wpCategories,
            config.wordpress?.categoryConstraints?.fallbackCategory || '未分类'
          );
          console.log(`   🏷️  "${article.category}" -> 分类ID ${article.categoryId}`);
        } catch (err) {
          console.log(`   ⚠️ 分类映射失败: ${article.category} - ${err.message}`);
        }
      }
    }

    // 步骤 4: 发布到 WordPress
    console.log('📤 步骤 4/4: 发布到 WordPress...');
    const results = [];
    const startTime = Date.now();
    let successCount = 0;
    let pushSuccessCount = 0;

    for (let i = 0; i < processedArticles.length; i++) {
      const article = processedArticles[i];
      const url = article.url;
      console.log(`\n📄 发布 ${i + 1}/${processedArticles.length}: ${article.rewrittenTitle?.substring(0, 40) || '(无标题)'}...`);
      console.log('─'.repeat(80));

      const urlStartTime = Date.now();

      try {
        // 准备 AI 处理结果（适配现有结构）
        const originalArticle = articlesData.find(a => a.url === url);
        const aiProcessResult = {
          finalTitle: article.rewrittenTitle,
          finalContent: article.rewrittenContent,
          category: article.category,
          categoryId: article.categoryId,
          originalTitle: originalArticle?.title || ''  // 原始英文标题，用于来源链接
        };

        // 图片上传处理
        let featuredMediaId = null;
        if (originalArticle?.imageUrl) {
          console.log('🖼️ 开始处理特色图片...');
          try {
            const uploadResult = await wpConnector.uploadImageFromUrl(originalArticle.imageUrl);
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

        // 推送到 WordPress
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

        console.log(`✅ 发布完成 (${urlDuration}ms) - ${pushResult.success ? '成功' : '失败'}`);

        // 从队列文件中移除已处理的URL
        removeUrlFromFile(urlFile, url);

      } catch (error) {
        const urlDuration = Date.now() - urlStartTime;

        results.push({
          url,
          success: false,
          duration: urlDuration,
          error: error.message
        });

        console.log(`❌ 发布失败: ${error.message} (${urlDuration}ms)`);
        removeUrlFromFile(urlFile, url);
      }

      // 添加延迟避免请求过快
      if (i < processedArticles.length - 1) {
        console.log('⏱️  等待3秒后继续...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    const totalDuration = Date.now() - startTime;

    // 显示最终结果
    console.log('\n' + '='.repeat(80));
    console.log('🎉 批处理完成！');
    console.log('='.repeat(80));
    console.log(`📊 处理统计:`);
    console.log(`   🚀 处理模式: ${useBatchMode ? '批处理 (2次 AI 调用)' : '逐个处理 (降级模式)'}`);
    console.log(`   📥 提取成功: ${articlesData.length}/${urls.length}`);
    console.log(`   ✅ 处理成功: ${processedArticles.length}/${articlesData.length}`);
    console.log(`   📤 发布成功: ${pushSuccessCount}/${processedArticles.length}`);
    console.log(`⏱️  总耗时: ${Math.round(totalDuration/1000)}秒`);
    if (processedArticles.length > 0) {
      console.log(`📈 平均处理时间: ${Math.round(totalDuration/processedArticles.length/1000)}秒/篇`);
    }

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

module.exports = { main, readUrlsFromFile, removeUrlFromFile, extractNewsFromUrl };
