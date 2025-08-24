#!/usr/bin/env node

/**
 * Google News 功能测试脚本
 * 专门测试Google News新闻发现功能
 */

const { MultiAIManager } = require('../../utils/multiAIManager');
const { findRelevantLinks, isGoogleNews } = require('../../utils/sourceAnalyzer_new');
const { resolveGoogleNewsUrls, filterGoogleNewsLinks, getGoogleNewsHeaders } = require('../../utils/googleNewsHandler');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 加载配置
const config = require('../../config/config.remote-230.json');

/**
 * 测试Google News功能
 */
async function testGoogleNews() {
  console.log('🧪 Google News 功能测试开始');
  console.log('=====================================\n');

  try {
    // 1. 初始化AI管理器
    console.log('🤖 初始化AI管理器...');
    const multiAIManager = new MultiAIManager(config);
    console.log('✅ AI管理器准备就绪。\n');

    // 2. 测试都柏林新闻源
    const dublinUrl = "https://news.google.com/topics/CAAqJQgKIh9DQkFTRVFvSUwyMHZNREpqWm5RU0JXVnVMVWRDS0FBUAE?ceid=IE:en&oc=3";
    const keywords = ["dublin", "ireland", "irish", "dublin city", "temple bar"];

    console.log(`🔍 测试Google News - 都柏林新闻源`);
    console.log(`URL: ${dublinUrl}`);
    console.log(`关键词: [${keywords.join(', ')}]\n`);

    // 3. 验证URL识别
    const isGoogleNewsUrl = isGoogleNews(dublinUrl);
    console.log(`   📋 Google News识别: ${isGoogleNewsUrl ? '✅ 正确识别' : '❌ 识别失败'}`);

    if (!isGoogleNewsUrl) {
      console.error('❌ URL识别失败，退出测试');
      return;
    }

    // 4. 获取页面内容（简化版，限制大小）
    console.log(`   📡 正在获取页面内容...`);
    const response = await axios.get(dublinUrl, {
      headers: getGoogleNewsHeaders(),
      timeout: 30000
    });
    
    const html = response.data;
    console.log(`   ✅ 成功获取页面，大小: ${html.length} 字符`);

    // 5. AI分析并发现链接（限制处理量以节省时间）
    console.log(`   🤖 正在使用AI分析Google News内容（简化版）...`);
    
    // 截取较小的HTML片段进行快速测试
    const testHtml = html.substring(0, 30000);
    const discoveredLinks = await findRelevantLinks(testHtml, keywords, dublinUrl, multiAIManager);
    
    console.log(`   ✅ AI发现 ${discoveredLinks.length} 个潜在链接`);

    if (discoveredLinks.length === 0) {
      console.log('   ⚠️ 未发现任何链接，可能需要调整分析策略');
      return;
    }

    // 6. 显示发现的链接样例
    console.log(`\n📋 发现的链接样例（前5个）:`);
    discoveredLinks.slice(0, 5).forEach((link, index) => {
      console.log(`   ${index + 1}. ${link}`);
    });

    // 7. 过滤Google News链接
    console.log(`\n🧹 过滤Google News链接...`);
    const filteredLinks = filterGoogleNewsLinks(discoveredLinks);
    console.log(`   过滤前: ${discoveredLinks.length} 个链接`);
    console.log(`   过滤后: ${filteredLinks.length} 个链接`);

    // 8. 解析重定向（测试前3个链接以节省时间）
    if (filteredLinks.length > 0) {
      console.log(`\n🔗 测试Google News重定向解析（前3个链接）...`);
      const testLinks = filteredLinks.slice(0, 3);
      const resolvedLinks = await resolveGoogleNewsUrls(testLinks);
      
      console.log(`\n📊 重定向解析结果:`);
      testLinks.forEach((original, index) => {
        const resolved = resolvedLinks[index] || '解析失败';
        console.log(`   原始链接: ${original.substring(0, 80)}...`);
        console.log(`   解析后: ${resolved.substring(0, 80)}...`);
        console.log(`   状态: ${resolved !== original ? '✅ 成功重定向' : '⚠️ 无重定向'}`);
        console.log('');
      });
    }

    // 9. 保存测试结果
    const testResult = {
      timestamp: new Date().toISOString(),
      sourceUrl: dublinUrl,
      keywords: keywords,
      discoveredLinksCount: discoveredLinks.length,
      filteredLinksCount: filteredLinks.length,
      sampleLinks: discoveredLinks.slice(0, 10),
      status: 'success'
    };

    const resultPath = path.resolve(__dirname, '../../reports/google-news-test-result.json');
    fs.writeFileSync(resultPath, JSON.stringify(testResult, null, 2));
    console.log(`📄 测试结果已保存到: ${resultPath}`);

    console.log('\n🎉 Google News 功能测试完成！');
    
  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:', error.message);
    console.error('堆栈信息:', error.stack);
  }
}

if (require.main === module) {
  testGoogleNews();
}
