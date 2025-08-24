#!/usr/bin/env node

/**
 * Google News 快速测试脚本
 * 简化版本，专门测试Google News链接发现功能
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { getGoogleNewsHeaders } = require('../../utils/googleNewsHandler');

/**
 * 简化的Google News链接提取器
 */
const extractGoogleNewsLinksSimple = (html) => {
  console.log('🔍 使用简化方式提取Google News链接...');
  
  const $ = cheerio.load(html);
  const links = [];
  
  // 查找所有包含 "./articles/" 的链接
  $('a[href*="./articles/"]').each((i, element) => {
    const href = $(element).attr('href');
    if (href && href.startsWith('./articles/')) {
      const fullLink = `https://news.google.com${href.substring(1)}`;
      links.push(fullLink);
    }
  });
  
  // 查找所有包含 "./stories/" 的链接
  $('a[href*="./stories/"]').each((i, element) => {
    const href = $(element).attr('href');
    if (href && href.startsWith('./stories/')) {
      const fullLink = `https://news.google.com${href.substring(1)}`;
      links.push(fullLink);
    }
  });
  
  // 查找直接的外部新闻链接
  $('a[href^="http"]').each((i, element) => {
    const href = $(element).attr('href');
    if (href && 
        !href.includes('google.com') && 
        (href.includes('bbc.com') || 
         href.includes('rte.ie') || 
         href.includes('independent.ie') ||
         href.includes('thejournal.ie'))) {
      links.push(href);
    }
  });
  
  // 去重
  const uniqueLinks = [...new Set(links)];
  console.log(`   ✅ 简化提取完成，发现 ${uniqueLinks.length} 个唯一链接`);
  
  return uniqueLinks;
};

/**
 * 快速测试Google News
 */
async function quickTestGoogleNews() {
  console.log('🧪 Google News 快速测试开始');
  console.log('================================\n');

  const testUrls = [
    {
      name: "Google News - Dublin",
      url: "https://news.google.com/topics/CAAqJQgKIh9DQkFTRVFvSUwyMHZNREpqWm5RU0JXVnVMVWRDS0FBUAE?ceid=IE:en&oc=3"
    },
    {
      name: "Google News - Ireland", 
      url: "https://news.google.com/topics/CAAqJQgKIh9DQkFTRVFvSUwyMHZNRE55ZERrU0JXVnVMVWRDS0FBUAE?ceid=IE:en&oc=3"
    }
  ];

  for (const source of testUrls) {
    console.log(`🔍 测试 ${source.name}`);
    console.log('─'.repeat(50));

    try {
      // 获取页面内容
      console.log(`📡 正在访问: ${source.url}`);
      const response = await axios.get(source.url, {
        headers: getGoogleNewsHeaders(),
        timeout: 30000
      });

      console.log(`   ✅ 成功获取页面，大小: ${response.data.length} 字符`);

      // 简化链接提取
      const links = extractGoogleNewsLinksSimple(response.data);
      
      if (links.length > 0) {
        console.log(`\n📋 发现的链接 (前10个):`);
        links.slice(0, 10).forEach((link, index) => {
          console.log(`   ${index + 1}. ${link}`);
        });
        
        // 分析链接类型
        const googleNewsLinks = links.filter(link => link.includes('news.google.com/articles/'));
        const externalLinks = links.filter(link => !link.includes('google.com'));
        
        console.log(`\n📊 链接分析:`);
        console.log(`   - Google News文章链接: ${googleNewsLinks.length} 个`);
        console.log(`   - 外部直接链接: ${externalLinks.length} 个`);
        console.log(`   - 总计: ${links.length} 个`);
      } else {
        console.log(`   ⚠️ 未发现任何链接`);
      }

    } catch (error) {
      console.error(`   ❌ 测试失败: ${error.message}`);
    }

    console.log('\n');
  }

  console.log('🎉 Google News 快速测试完成！');
}

if (require.main === module) {
  quickTestGoogleNews();
}
