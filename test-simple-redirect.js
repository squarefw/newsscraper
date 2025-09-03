// 基于GitHub仓库的RSS解析器测试
const { fetchRedirectUrl } = require('./utils/puppeteerResolver_enhanced');

async function testUrlWithSimpleRedirect() {
    console.log('🧪 测试简单重定向方法 (基于GitHub仓库)');
    console.log('=======================================\n');
    
    // 使用用户提供的URL
    const testUrl = 'https://news.google.com/read/CBMiwgJBVV95cUxNQjFJSTRfekZTUkNBREIzSkVlcENUUTBleEFzS1p4RkFJSThjbHMzTU00eVJXTGliVDFaaDFBalhpNG5fVzJTa0FmV0xkWlRiWksyVzlXdVZ1bTdfYzZsNjZFLUlXQUQzRFZYMjJlU0NvSzhFNUJpYU5fNm9lbWJNcHpydGNEbUVtU0hFWFJwQ25jT0VVcG1oUENySmQ0Y2QzdjJReXBsaEVib2tqNk9qaUhUNmhjV0dUdkdpbjZZZW9Fc2gxWmo2X3lqSzZjVFpzN1JzVjhMM1JlbmQ5NE95eEdNcGZXQ1RVZDNxS1FXQWN4SkdCanA2dElpRUFLYndzQUZFcnl4N24zOWNiT0lwd2ltUUlDVXYybzk4RmxHc2REdzJKUDVINXNrQ3lFbHhWNnhBczQ0ay1lVzdRVUlsZ2V3?hl=en-IE&gl=IE&ceid=IE%3Aen';
    
    console.log(`🎯 测试URL: ${testUrl.substring(0, 120)}...`);
    console.log();
    
    const startTime = Date.now();
    
    try {
        console.log('📡 尝试简单HTTP重定向...');
        const redirectResult = await fetchRedirectUrl(testUrl);
        const endTime = Date.now();
        
        console.log(`\n⏱️ 执行时间: ${((endTime - startTime) / 1000).toFixed(2)} 秒`);
        
        if (redirectResult && redirectResult !== testUrl) {
            console.log(`✅ 重定向成功! 获得真实URL:`);
            console.log(`   ${redirectResult}`);
            
            // 验证URL是否有效
            if (!redirectResult.includes('google.com') && !redirectResult.includes('consent') && !redirectResult.includes('sorry')) {
                console.log('🎉 URL看起来是有效的新闻源！');
            } else {
                console.log('⚠️ URL可能仍然指向Google或阻止页面');
            }
        } else {
            console.log(`❌ 重定向失败或返回相同URL`);
            console.log(`   原URL: ${testUrl.substring(0, 100)}...`);
            console.log(`   结果: ${redirectResult || 'null'}`);
        }
        
    } catch (error) {
        console.error(`❌ 测试失败: ${error.message}`);
        console.error(`📋 错误详情: ${error.stack}`);
    }
}

// 执行测试
testUrlWithSimpleRedirect().catch(console.error);
