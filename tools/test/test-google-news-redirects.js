#!/usr/bin/env node

/**
 * Google News 重定向解析测试
 * 测试Google News链接的重定向功能
 */

const { resolveGoogleNewsUrl } = require('../../utils/googleNewsHandler');
const { resolveWithPuppeteer } = require('../../utils/puppeteerResolver');

/**
 * 测试Google News重定向解析
 */
async function testGoogleNewsRedirects() {
  console.log('🧪 Google News 重定向解析测试开始');
  console.log('=======================================\n');

  // 测试链接（从快速测试中获取的真实链接）
  const testLinks = [
    "https://news.google.com/stories/CAAqNggKIjBDQklTSGpvSmMzUnZjbmt0TXpZd1NoRUtEd2lPdGI2TUR4RnhTeW5HNXozRWlDZ0FQAQ?hl=en-IE&gl=IE&ceid=IE%3Aen",
    "https://news.google.com/stories/CAAqNggKIjBDQklTSGpvSmMzUnZjbmt0TXpZd1NoRUtEd2lUNi0yZUR4RlBtcTA1X0tXTzZDZ0FQAQ?hl=en-IE&gl=IE&ceid=IE%3Aen",
    "https://news.google.com/stories/CAAqNggKIjBDQklTSGpvSmMzUnZjbmt0TXpZd1NoRUtEd2pTcEoyUER4R0RTeDg0ZmRKM0lTZ0FQAQ?hl=en-IE&gl=IE&ceid=IE%3Aen"
  ];

  console.log(`🔗 开始测试 ${testLinks.length} 个Google News链接的重定向解析...\n`);

  for (let i = 0; i < testLinks.length; i++) {
    const link = testLinks[i];
    console.log(`\n${i + 1}. 测试链接 ${i + 1}:`);
    console.log(`   原始链接: ${link.substring(0, 100)}...`);
    
    // --- 方法一: 使用axios ---
    console.log(`\n   --- 方法一: Axios HTTP请求 ---`);
    try {
      const resolvedLinkAxios = await resolveGoogleNewsUrl(link);
      if (resolvedLinkAxios && resolvedLinkAxios !== link) {
        console.log(`   ✅ Axios解析成功: ${resolvedLinkAxios}`);
      } else {
        console.log(`   ⚠️ Axios未能解析到外部链接`);
      }
    } catch (error) {
      console.log(`   ❌ Axios解析错误: ${error.message}`);
    }

    // --- 方法二: 使用Puppeteer ---
    console.log(`\n   --- 方法二: Puppeteer模拟浏览器 ---`);
    try {
      const resolvedLinkPuppeteer = await resolveWithPuppeteer(link);
      if (resolvedLinkPuppeteer && resolvedLinkPuppeteer !== link) {
        console.log(`   ✅ Puppeteer解析成功: ${resolvedLinkPuppeteer}`);
      } else {
        console.log(`   ⚠️ Puppeteer未能解析到外部链接`);
      }
    } catch (error) {
      console.log(`   ❌ Puppeteer解析错误: ${error.message}`);
    }
    
    // 添加延迟以避免对Google服务器造成压力
    if (i < testLinks.length - 1) {
      console.log('\n   ⏱️ 等待 2 秒...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('🎉 Google News 重定向解析测试完成！');
}

if (require.main === module) {
  testGoogleNewsRedirects();
}
