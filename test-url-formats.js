const { fetchRedirectUrl, decodeGoogleNewsUrlStatic } = require('./utils/puppeteerResolver_enhanced');

async function testUrlFormats() {
    // 测试一个示例URL
    const originalUrl = "https://news.google.com/rss/articles/CBMi6AFBVV95cUxQVUw0eW5aU3IzWVA5RURqbXgwT2F4dERHckxLUElxRFM1U29NOWpKcnNJdFNWYlktcjB1UTJDQzZEc1BzOW8yZWdfM0VnZTQ3Vi03SmpucmRZT3Y2N3ZGb0p6RW9XMXkwZlBLUXMwbVR6blFMOWZPbVJ2WTM0bFA5WERKaDB6Rmh2T2tUWGhMNlZ3Q1lVOU1QYmt4OXZvOExqdmNneWhib1NFa3lCUmszRTZjUGV2Q2NLNlJDR1ZZVzdsQVh2QnhjeTNjZXVrNlNFUDdjX2VJaElKakRkcnc3cndaalctRHpO?oc=5&ucbcb=1&hl=en-IE&gl=IE&ceid=IE:en";
    
    console.log("🔍 测试URL格式变化");
    console.log("==================");
    
    // 从RSS获取的原始短URL
    const shortUrl = "https://news.google.com/rss/articles/CBMi6AFBVV95cUxQVUw0eW5aU3IzWVA5RURqbXgwT2F4dERHckxLUElxRFM1U29NOWpKcnNJdFNWYlktcjB1UTJDQzZEc1BzOW8yZWdfM0VnZTQ3Vi03SmpucmRZT3Y2N3ZGb0p6RW9XMXkwZlBLUXMwbVR6blFMOWZPbVJ2WTM0bFA5WERKaDB6Rmh2T2tUWGhMNlZ3Q1lVOU1QYmt4OXZvOExqdmNneWhib1NFa3lCUmszRTZjUGV2Q2NLNlJDR1ZZVzdsQVh2QnhjeTNjZXVrNlNFUDdjX2VJaElKakRkcnc3cndaalctRHpO";
    
    console.log("\n📏 原始短URL:");
    console.log(`长度: ${shortUrl.length}`);
    console.log(`内容: ${shortUrl}`);
    
    console.log("\n🔄 进行重定向...");
    const redirectedUrl = await fetchRedirectUrl(shortUrl);
    
    if (redirectedUrl) {
        console.log("\n📏 重定向后URL:");
        console.log(`长度: ${redirectedUrl.length}`);
        console.log(`内容: ${redirectedUrl}`);
        
        // 比较编码部分
        const shortEncoded = shortUrl.match(/CBM[^?]+/)?.[0];
        const longEncoded = redirectedUrl.match(/CBM[^?]+/)?.[0];
        
        console.log("\n🔍 编码部分对比:");
        console.log(`短URL编码: ${shortEncoded?.substring(0, 100)}...`);
        console.log(`长URL编码: ${longEncoded?.substring(0, 100)}...`);
        console.log(`编码部分相同: ${shortEncoded === longEncoded}`);
        
        // 测试两个版本的静态解码
        console.log("\n🧪 静态解码测试:");
        console.log("短URL解码结果:");
        const shortResult = decodeGoogleNewsUrlStatic(shortUrl);
        
        console.log("\n长URL解码结果:");
        const longResult = decodeGoogleNewsUrlStatic(redirectedUrl);
        
        console.log(`\n结果对比: 短=${!!shortResult}, 长=${!!longResult}`);
    }
}

testUrlFormats().catch(console.error);
