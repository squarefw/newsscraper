const { fetchUrlWithPuppeteer } = require('./utils/puppeteerResolver_enhanced');

async function testSimplifiedPuppeteer() {
    console.log('🧪 测试简化版Puppeteer解析器 (GitHub模式)');
    console.log('===========================================\n');
    
    // 使用用户提供的URL
    const testUrl = 'https://news.google.com/read/CBMiwgJBVV95cUxNQjFJSTRfekZTUkNBREIzSkVlcENUUTBleEFzS1p4RkFJSThjbHMzTU00eVJXTGliVDFaaDFBalhpNG5fVzJTa0FmV0xkWlRiWksyVzlXdVZ1bTdfYzZsNjZFLUlXQUQzRFZYMjJlU0NvSzhFNUJpYU5fNm9lbWJNcHpydGNEbUVtU0hFWFJwQ25jT0VVcG1oUENySmQ0Y2QzdjJReXBsaEVib2tqNk9qaUhUNmhjV0dUdkdpbjZZZW9Fc2gxWmo2X3lqSzZjVFpzN1JzVjhMM1JlbmQ5NE95eEdNcGZXQ1RVZDNxS1FXQWN4SkdCanA2dElpRUFLYndzQUZFcnl4N24zOWNiT0lwd2ltUUlDVXYybzk4RmxHc2REdzJKUDVINXNrQ3lFbHhWNnhBczQ0ay1lVzdRVUlsZ2V3?hl=en-IE&gl=IE&ceid=IE%3Aen';
    
    console.log(`🎯 测试URL: ${testUrl.substring(0, 120)}...`);
    console.log();
    
    const startTime = Date.now();
    
    try {
        const result = await fetchUrlWithPuppeteer(testUrl, { timeout: 20000 });
        const endTime = Date.now();
        
        console.log(`\n⏱️ 执行时间: ${((endTime - startTime) / 1000).toFixed(2)} 秒`);
        console.log(`📊 结果类型: ${Array.isArray(result) ? 'Array' : typeof result}`);
        
        if (Array.isArray(result) && result.length > 0) {
            console.log(`✅ 成功解析! 获得 ${result.length} 个URL:`);
            result.forEach((url, index) => {
                console.log(`   ${index + 1}. ${url}`);
            });
        } else if (Array.isArray(result) && result.length === 0) {
            console.log(`⚠️ 解析返回空数组 - 可能遇到consent页面或网络问题`);
        } else {
            console.log(`❌ 解析失败: ${result}`);
        }
        
    } catch (error) {
        console.error(`❌ 测试失败: ${error.message}`);
        console.error(`📋 错误详情: ${error.stack}`);
    }
}

// 执行测试
testSimplifiedPuppeteer().catch(console.error);
