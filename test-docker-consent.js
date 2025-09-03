#!/usr/bin/env node

/**
 * 测试Docker环境下的Google News consent处理功能
 */

const { resolveGoogleNewsUrls } = require('./utils/puppeteerResolver_docker');

async function testSpecificUrl() {
    console.log('🧪 开始测试特定Google News URL的consent处理功能...');
    
    // 使用指定的Google News URL
    const testUrls = [
        'https://news.google.com/read/CBMi1AFBVV95cUxNX0NIWHMwZVd3aGN4TzNhekhHdkxJakJPdmw2RmJrQzlLeDBVTWh3Q2tVTzAyb21MMHpzRDNWSV9NN3FQWE9NdFU3RExLaGl2NkZCdUpBYy0tUW9aS0o0T3lyX1pMcjVaRmQwUVZ2aThzOFRQaUdCdDZ1Rzdjek9fNkdpLUw2cFZTbGJYMU0zeWFEVjZDRHZGX0RCMHJnNjUyc0psR1lJd0NsRlh6elRSSmRFU0xZSHRPOXBEXzBGdGZWMUtNTzd4MWFlT1hsRW5XckJUbg?hl=en-IE&gl=IE&ceid=IE%3Aen'
    ];
    
    console.log(`测试URL: ${testUrls[0]}`);
    
    const results = await resolveGoogleNewsUrls(testUrls);
    
    console.log('\n📊 测试结果:');
    console.log(`- 输入URL数量: ${testUrls.length}`);
    console.log(`- 成功解析数量: ${results.length}`);
    console.log(`- 解析的URL:`, results);
    
    return results;
}

async function main() {
    console.log('🚀 开始测试Docker环境下的Google News consent处理功能');
    console.log('='.repeat(70));
    
    try {
        const results = await testSpecificUrl();
        
        console.log('\n✅ 测试完成');
        console.log(`成功解析的URL数量: ${results.length}`);
        
        if (results.length > 0) {
            console.log('\n解析成功的URL:');
            results.forEach((url, index) => {
                console.log(`${index + 1}. ${url}`);
            });
        } else {
            console.log('\n⚠️ 没有成功解析任何URL，可能需要调整策略');
        }
        
    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
