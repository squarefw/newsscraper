#!/usr/bin/env node

/**
 * 测试增强版Google News URL解析器
 */

const { 
    debugDecodeUrl, 
    getNewsLinksFromTopic,
    resolveGoogleNewsUrls 
} = require('./utils/puppeteerResolver');

const { 
    getOriginalNewsLinksFromTopic 
} = require('./utils/puppeteerResolver_enhanced');

async function testEnhancedResolver() {
    console.log('🚀 测试增强版Google News URL解析器');
    console.log('='.repeat(60));
    
    // 测试URL
    const topicUrl = "https://news.google.com/topics/CAAqJQgKIh9DQkFTRVFvSUwyMHZNREpqWm5RU0JXVnVMVWRDS0FBUAE?ceid=IE:en&oc=3";
    const sampleEncodedUrl = "https://news.google.com/rss/articles/CBMi4AFBVV95cUxOMXlvMDdZa3hXUmw1Qnp3Vm5DMEtnTVk5Xy00bnVicG9IZzczWDFVaHRqQmZWQnNoaWZrODBjcnZLTFZWYXJsT1J1SmZ2TUdyN0R2OG9pWE1OTl9WNkFjelZ4MXQxM1h6Qkk0YzNqVnVCV28yT0tvYk5Cb0JsdmNTS3lMdEJESW9fdVVGTXNvVFhZT3A5Uk5PR0xXbzllNzBIMklYTXI0Z3R1WllsQWIwcmFIYzZLUno2NUFaem5jd09YbjZRSG03azdtV25STkE0SDFzMDVCODZVRFdHWklRcg?oc=5";
    
    try {
        // 测试1：单个URL解码
        console.log('\n📝 测试1：单个URL解码');
        console.log('─'.repeat(40));
        await debugDecodeUrl(sampleEncodedUrl);
        
        // 测试2：从Topic获取链接（完整流程）
        console.log('\n📝 测试2：从Topic获取原始链接');
        console.log('─'.repeat(40));
        const originalLinks = await getOriginalNewsLinksFromTopic(topicUrl, {
            enablePuppeteer: true // 启用Puppeteer作为备用方案
        });
        
        console.log(`\n✅ 获取到 ${originalLinks.length} 个原始链接:`);
        originalLinks.slice(0, 5).forEach((link, index) => {
            console.log(`${index + 1}. ${link}`);
        });
        
        if (originalLinks.length > 5) {
            console.log(`... 还有 ${originalLinks.length - 5} 个链接`);
        }
        
        // 测试3：如果RSS失败，测试Puppeteer方式
        if (originalLinks.length === 0) {
            console.log('\n📝 测试3：RSS失败，尝试Puppeteer直接抓取');
            console.log('─'.repeat(40));
            
            const { fetchUrlWithPuppeteer } = require('./utils/puppeteerResolver_enhanced');
            const puppeteerLinks = await fetchUrlWithPuppeteer(topicUrl);
            
            console.log(`\n✅ Puppeteer获取到 ${puppeteerLinks.length} 个链接:`);
            puppeteerLinks.slice(0, 5).forEach((link, index) => {
                console.log(`${index + 1}. ${link}`);
            });
        }
        
    } catch (error) {
        console.error(`❌ 测试失败: ${error.message}`);
        console.error(error.stack);
    }
}

// 运行测试
if (require.main === module) {
    testEnhancedResolver()
        .then(() => {
            console.log('\n🎉 测试完成');
            process.exit(0);
        })
        .catch(error => {
            console.error(`💥 测试异常: ${error.message}`);
            process.exit(1);
        });
}

module.exports = { testEnhancedResolver };
