#!/usr/bin/env node

/**
 * NewsScraper 批量AI处理与推送脚本
 * 从文件读取多个新闻URL，批量执行AI处理流程，并推送到远程API
 */

const { AIFactory } = require('../../dist/ai/factory');
const { initApiClient, pushNewsArticle } = require('../../dist/apiClient');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const config = require('../../config/config.development.json');

// 获取任务中文名称
const getTaskName = (task) => {
  const taskNames = {
    'translate': '翻译',
    'rewrite': '重写',
    'summarize': '摘要',
    'extract_keywords': '关键词提取',
    'categorize': '智能分类',
    'sentiment': '情感分析'
  };
  return taskNames[task] || task;
};

// 从URL提取新闻内容
const extractNewsFromUrl = async (url) => {
  console.log(`📡 正在访问: ${url}`);
  
  try {
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

// 执行AI任务序列
const processNewsWithAI = async (aiAgent, originalContent, tasks) => {
  const results = [];
  let processedTitle = originalContent.title;
  let processedContent = originalContent.content;
  let keywords = '';
  let category = '';
  let sentiment = '';
  let summary = '';
  
  console.log(`🤖 开始AI处理流程 (${tasks.length}个任务)`);
  
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const startTime = Date.now();
    
    try {
      console.log(`   ${i + 1}/${tasks.length} 执行 ${task.toUpperCase()} - ${getTaskName(task)}`);
      
      let inputContent;
      switch (task) {
        case 'translate':
          inputContent = processedContent;
          break;
        case 'rewrite':
          inputContent = processedContent;
          break;
        case 'summarize':
          inputContent = processedContent;
          break;
        case 'extract_keywords':
          inputContent = processedContent;
          break;
        case 'categorize':
          inputContent = processedContent;
          break;
        case 'sentiment':
          inputContent = processedContent;
          break;
        default:
          inputContent = processedContent;
      }

      const result = await aiAgent.processContent(inputContent, task);
      const duration = Date.now() - startTime;
      
      console.log(`     ✅ 完成 (${duration}ms) - 输出: ${result.length}字符`);
      
      // 更新处理后的内容用于下一个任务
      if (task === 'translate' || task === 'rewrite') {
        processedContent = result;
        processedTitle = result.split('\n')[0] || processedTitle; // 尝试提取标题
      }
      
      // 保存关键信息用于API推送
      switch (task) {
        case 'extract_keywords':
          keywords = result;
          break;
        case 'categorize':
          category = result;
          break;
        case 'sentiment':
          sentiment = result;
          break;
        case 'summarize':
          summary = result;
          break;
      }
      
      results.push({
        task,
        taskName: getTaskName(task),
        input: inputContent,
        output: result,
        duration,
        success: true
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`     ❌ 失败: ${error.message} (${duration}ms)`);
      
      results.push({
        task,
        taskName: getTaskName(task),
        input: processedContent,
        output: '',
        duration,
        success: false,
        error: error.message
      });
    }
  }
  
  return {
    originalTitle: originalContent.title,
    originalContent: originalContent.content,
    finalTitle: processedTitle,
    finalContent: processedContent,
    keywords,
    category,
    sentiment,
    summary,
    results
  };
};

// 根据分类名称获取分类ID (使用正确的UUID格式)
const getCategoryId = (categoryName) => {
  const categoryMap = {
    '科技': '4c19e28c-6eec-4fe2-8ecd-079620093426',
    '政治': 'cfcd49aa-bf03-4b18-8deb-a48ba92ff97a', 
    '经济': 'e55ab84c-76c8-4811-9df8-6f44ef2bab9b',
    '体育': '6f22716f-fcef-4b93-a0bc-31b07036a978',
    '娱乐': '549c4ef3-4dea-4df2-89aa-8fcf86efd51c', // 使用文化分类
    '健康': '549c4ef3-4dea-4df2-89aa-8fcf86efd51c', // 使用文化分类
    '教育': '549c4ef3-4dea-4df2-89aa-8fcf86efd51c', // 使用文化分类
    '环境': '549c4ef3-4dea-4df2-89aa-8fcf86efd51c', // 使用文化分类
    '社会': '8b5d0794-91a5-4e53-94d6-05b7e82fdb9e', // 使用热点新闻
    '国际': '8b5d0794-91a5-4e53-94d6-05b7e82fdb9e', // 使用热点新闻
    'technology': '4c19e28c-6eec-4fe2-8ecd-079620093426',
    'politics': 'cfcd49aa-bf03-4b18-8deb-a48ba92ff97a',
    'economy': 'e55ab84c-76c8-4811-9df8-6f44ef2bab9b',
    'sports': '6f22716f-fcef-4b93-a0bc-31b07036a978',
    'culture': '549c4ef3-4dea-4df2-89aa-8fcf86efd51c',
    'news': '8b5d0794-91a5-4e53-94d6-05b7e82fdb9e'
  };
  
  // 简单匹配逻辑
  if (!categoryName) {
    return '550e8400-e29b-41d4-a716-446655440000'; // 默认分类
  }
  
  const lowerCategoryName = categoryName.toLowerCase();
  for (const [name, id] of Object.entries(categoryMap)) {
    if (lowerCategoryName.includes(name.toLowerCase())) {
      return id;
    }
  }
  
  return '550e8400-e29b-41d4-a716-446655440000'; // 默认分类
};

// 解析关键词字符串为数组
const parseKeywords = (keywordsString) => {
  if (!keywordsString) return [];
  
  // 尝试多种分割方式
  const separators = [',', '，', ';', '；', '、', '\n', '|'];
  
  for (const sep of separators) {
    if (keywordsString.includes(sep)) {
      return keywordsString
        .split(sep)
        .map(keyword => keyword.trim())
        .filter(keyword => keyword.length > 0)
        .slice(0, 10); // 限制关键词数量
    }
  }
  
  // 如果没有分隔符，按空格分割
  return keywordsString
    .split(/\s+/)
    .filter(keyword => keyword.length > 1)
    .slice(0, 10);
};

// 推送处理后的新闻到API
const pushProcessedNews = async (processedData, originalUrl) => {
  try {
    console.log(`📤 准备推送到API: ${processedData.finalTitle}`);
    
    // 构建符合API要求的新闻文章对象 (只使用API接受的字段)
    const newsArticle = {
      title: processedData.finalTitle || processedData.originalTitle,
      content: processedData.finalContent || processedData.originalContent,
      categoryId: getCategoryId(processedData.category),
      tags: parseKeywords(processedData.keywords)
    };

    const response = await pushNewsArticle(newsArticle);
    console.log(`   ✅ 推送成功 - 响应ID: ${response.id || 'unknown'}`);
    
    return {
      success: true,
      response: response,
      articleId: response.id
    };
    
  } catch (error) {
    console.log(`   ❌ 推送失败: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
};

// 读取URL文件
const readUrlsFromFile = (filePath) => {
  try {
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

// 创建URL列表文件示例
const createSampleUrlFile = (filePath) => {
  const sampleUrls = `# NewsScraper 批量处理与推送URL列表
# 以 # 开头的行为注释，会被忽略
# 每行一个URL

# BBC新闻示例
https://www.bbc.com/news/world-europe-68123456
https://www.bbc.com/news/technology-68234567

# RTE新闻示例
https://www.rte.ie/news/world/2025/0730/1234567-example-news/
https://www.rte.ie/news/business/2025/0730/1234568-business-news/

# 其他新闻网站
https://example-news.com/article/sample-news-1
https://example-news.com/article/sample-news-2
`;

  fs.writeFileSync(filePath, sampleUrls, 'utf8');
  console.log(`✅ 示例URL文件已创建: ${filePath}`);
  console.log('请编辑此文件，添加要处理的新闻URL，然后重新运行脚本');
};

// 主函数
async function main() {
  console.log('🚀 NewsScraper 批量AI处理与推送脚本');
  console.log('=====================================\n');

  // 检查命令行参数
  const args = process.argv.slice(2);
  let urlFile = args[0];

  if (!urlFile) {
    console.log('使用方法: node batch-ai-push.js <url文件路径>');
    console.log('示例: node batch-ai-push.js urls.txt\n');
    
    // 询问是否创建示例文件
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const createSample = await new Promise((resolve) => {
      rl.question('是否创建示例URL文件? (y/n): ', (answer) => {
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });

    rl.close();

    if (createSample) {
      urlFile = 'examples/sample-urls.txt';
      createSampleUrlFile(urlFile);
      return;
    } else {
      process.exit(1);
    }
  }

  try {
    // 检查API配置
    console.log('📋 检查API配置...');
    console.log(`  API地址: ${config.api.baseUrl}`);
    console.log(`  API密钥: ${config.api.apiKey ? '***已配置***' : '❌ 未配置'}`);
    
    if (!config.api.baseUrl || !config.api.apiKey) {
      throw new Error('API配置不完整，请检查 config.development.json 中的 api.baseUrl 和 api.apiKey');
    }

    // 初始化API客户端 (支持自动token刷新)
    console.log('🔗 初始化API客户端...');
    const configPath = path.resolve(__dirname, '../../config/config.development.json');
    await initApiClient(config, configPath);
    console.log('✅ API客户端初始化成功\n');

    // 检查AI配置
    console.log('📋 检查AI配置...');
    console.log(`  引擎: ${config.ai.engine}`);
    console.log(`  状态: ${config.ai.enabled ? '✅ 启用' : '❌ 禁用'}`);
    console.log(`  任务: ${config.ai.tasks.join(', ')}`);
    
    if (config.ai.engine === 'ollama') {
      console.log(`  模型: ${config.ai.ollama?.model}`);
      console.log(`  地址: ${config.ai.ollama?.baseUrl}`);
    }
    console.log();

    if (!config.ai.enabled) {
      throw new Error('AI功能未启用，请在配置文件中设置 "enabled": true');
    }

    // 创建AI代理
    console.log('🚀 创建AI代理...');
    const aiAgent = AIFactory.getAgent(config);
    if (!aiAgent) {
      throw new Error('AI代理创建失败');
    }
    console.log('✅ AI代理创建成功\n');

    // 读取URL列表
    const urls = readUrlsFromFile(urlFile);
    if (urls.length === 0) {
      throw new Error('没有找到有效的URL');
    }

    // 准备任务列表
    const tasks = config.ai.tasks.filter(task => 
      ['translate', 'rewrite', 'summarize', 'extract_keywords', 'categorize', 'sentiment'].includes(task)
    );

    console.log(`📝 准备处理 ${urls.length} 个URL，每个URL执行 ${tasks.length} 个AI任务并推送到API\n`);

    // 批量处理
    const results = [];
    const startTime = Date.now();
    let successCount = 0;
    let pushSuccessCount = 0;
    let totalTasks = 0;
    let successTasks = 0;

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`\n📄 处理 ${i + 1}/${urls.length}: ${url}`);
      console.log('─'.repeat(80));
      
      const urlStartTime = Date.now();
      
      try {
        // 提取新闻内容
        const originalContent = await extractNewsFromUrl(url);
        
        // AI处理
        const aiProcessResult = await processNewsWithAI(aiAgent, originalContent, tasks);
        
        // 推送到API
        const pushResult = await pushProcessedNews(aiProcessResult, url);
        
        const urlDuration = Date.now() - urlStartTime;
        
        // 统计AI任务
        totalTasks += aiProcessResult.results.length;
        successTasks += aiProcessResult.results.filter(r => r.success).length;
        
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
    console.log('🎉 批量处理与推送完成！');
    console.log('='.repeat(80));
    console.log(`📊 URL处理统计:`);
    console.log(`   ✅ 成功提取: ${successCount}/${urls.length} (${((successCount/urls.length)*100).toFixed(1)}%)`);
    console.log(`   ❌ 提取失败: ${urls.length - successCount}/${urls.length}`);
    console.log(`📊 API推送统计:`);
    console.log(`   ✅ 推送成功: ${pushSuccessCount}/${successCount} (${successCount > 0 ? ((pushSuccessCount/successCount)*100).toFixed(1) : 0}%)`);
    console.log(`   ❌ 推送失败: ${successCount - pushSuccessCount}/${successCount}`);
    console.log(`📊 AI任务统计:`);
    console.log(`   ✅ 成功: ${successTasks}/${totalTasks} (${totalTasks > 0 ? ((successTasks/totalTasks)*100).toFixed(1) : 0}%)`);
    console.log(`   ❌ 失败: ${totalTasks - successTasks}/${totalTasks}`);
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

  } catch (error) {
    console.error('❌ 批量处理失败:', error.message);
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, readUrlsFromFile, processNewsWithAI, pushProcessedNews };
