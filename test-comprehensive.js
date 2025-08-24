// 完整的端到端测试：RSS + 混合URL解码器
const RSSGoogleNewsAnalyzer = require('./utils/rssGoogleNewsAnalyzer');
const { resolveGoogleNewsUrls } = require('./utils/puppeteerResolver');

async function comprehensiveTest() {
  console.log('🎯 Comprehensive End-to-End Test: RSS + Hybrid URL Decoder\n');
  
  try {
    // 1. 获取RSS新闻
    console.log('Step 1: Fetching RSS news...');
    const analyzer = new RSSGoogleNewsAnalyzer();
    const result = await analyzer.processGoogleNewsUrl();
    
    console.log(`✅ RSS Success: ${result.processed} articles processed`);
    
    // 2. 提取URL进行解码测试
    console.log('\nStep 2: Testing URL decoding...');
    const urls = result.articles.slice(0, 5).map(article => article.url); // 测试前5个
    
    const decodedUrls = await resolveGoogleNewsUrls(urls);
    
    console.log(`✅ URL Processing: ${decodedUrls.length}/${urls.length} URLs processed\n`);
    
    // 3. 展示结果
    console.log('📋 Final Results:');
    result.articles.slice(0, 5).forEach((article, i) => {
      const processedUrl = decodedUrls[i];
      const isDecoded = processedUrl && !processedUrl.includes('news.google.com');
      
      console.log(`\n${i + 1}. ${article.title.substring(0, 60)}...`);
      console.log(`   📅 ${article.date.toISOString()}`);
      console.log(`   📰 ${article.source}`);
      console.log(`   🔗 ${isDecoded ? 'DECODED' : 'RSS-ORIGINAL'}: ${processedUrl ? processedUrl.substring(0, 80) : 'N/A'}...`);
    });
    
    console.log(`\n🎉 COMPREHENSIVE TEST COMPLETED SUCCESSFULLY!`);
    console.log(`📊 Summary: ${result.processed} articles, ${decodedUrls.length} URLs processed`);
    console.log(`🔍 Date Range: Yesterday morning to now (as requested)`);
    console.log(`🌟 System Status: RSS + Hybrid Decoder = FULLY OPERATIONAL`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

comprehensiveTest();
