#!/usr/bin/env node

/**
 * 新闻文章筛选测试脚本
 * 测试从pending-urls.txt读取链接，并使用AI筛选真正的新闻文章页面
 */

const fs = require('fs');
const path = require('path');
const { MultiAIManager } = require('../utils/multiAIManager');
const NewsArticleFilter = require('../utils/newsArticleFilter');

/**
 * 获取链接的基本内容信息
 */
const getLinkContentInfo = async (url) => {
  try {
    const axios = require('axios');
    const cheerio = require('cheerio');
    
    console.log(`     📡 访问: ${url.slice(0, 60)}...`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsScraperBot/1.0)'
      },
      timeout: 10000,
      maxContentLength: 2000000 // 增加到2MB
    });
    
    const $ = cheerio.load(response.data);
    
    // 提取标题
    let title = $('title').text().trim() ||
                $('h1').first().text().trim() ||
                $('meta[property="og:title"]').attr('content') ||
                '';
    
    // 提取正文内容
    let content = '';
    
    // 移除脚本和样式
    $('script, style, nav, footer, header, aside').remove();
    
    // 尝试多种内容选择器
    const contentSelectors = [
      'article',
      '.article-content',
      '.content',
      '.post-content',
      '.entry-content',
      'main',
      '.main-content'
    ];
    
    for (const selector of contentSelectors) {
      if ($(selector).length > 0) {
        content = $(selector).text().trim();
        break;
      }
    }
    
    // 如果没有找到特定内容区域，提取所有段落
    if (!content) {
      content = $('p').map((i, el) => $(el).text().trim()).get().join(' ');
    }
    
    // 清理内容
    content = content.replace(/\s+/g, ' ').substring(0, 2000);
    
    console.log(`     ✅ 提取成功 - 标题: ${title.length}字符, 内容: ${content.length}字符`);
    
    return {
      url: url,
      title: title,
      content: content,
      success: true
    };
    
  } catch (error) {
    console.log(`     ❌ 提取失败: ${error.message}`);
    return {
      url: url,
      title: '',
      content: '',
      success: false
    };
  }
};

async function main() {
  console.log('🔍 新闻文章筛选测试');
  console.log('==============================\n');

  try {
    // 1. 加载配置
    const configPath = path.resolve(__dirname, '../config/config.remote-230.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // 2. 初始化AI管理器
    console.log('🤖 初始化AI管理器...');
    const multiAIManager = new MultiAIManager(config);
    await multiAIManager.initialize();
    console.log('✅ AI管理器准备就绪\n');

    // 3. 读取pending-urls.txt中的链接
    const urlsPath = path.resolve(__dirname, '../examples/pending-urls.txt');
    if (!fs.existsSync(urlsPath)) {
      console.log('❌ pending-urls.txt 文件不存在');
      return;
    }

    const urlsContent = fs.readFileSync(urlsPath, 'utf8');
    const urls = urlsContent.split('\n').filter(url => url.trim()).slice(0, 10); // 只测试前10个
    
    console.log(`📋 读取到 ${urls.length} 个链接进行测试\n`);

    // 4. 获取链接内容信息
    console.log('📡 获取链接内容信息...');
    const linkDataArray = [];
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`   ${i + 1}/${urls.length}: ${url.slice(0, 60)}...`);
      const contentInfo = await getLinkContentInfo(url);
      linkDataArray.push(contentInfo);
    }
    
    console.log('✅ 内容获取完成\n');

    // 5. 初始化文章筛选器并执行筛选
    const articleFilter = new NewsArticleFilter(multiAIManager);
    const articleLinks = await articleFilter.filterNewsArticles(linkDataArray);

    // 6. 显示结果
    console.log('\n📊 筛选结果总结:');
    console.log(`   原始链接数: ${urls.length}`);
    console.log(`   新闻文章数: ${articleLinks.length}`);
    console.log(`   过滤掉的数: ${urls.length - articleLinks.length}`);

    // 7. 保存筛选后的新闻文章链接
    if (articleLinks.length > 0) {
      const filteredPath = path.resolve(__dirname, '../examples/filtered-news-articles.txt');
      fs.writeFileSync(filteredPath, articleLinks.join('\n'), 'utf8');
      console.log(`\n✅ 筛选后的新闻文章已保存到: ${filteredPath}`);
    }

  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
