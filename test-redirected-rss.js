const https = require('https');

// 测试重定向后的URL
async function testRedirectedRSS() {
  const redirectedUrl = 'https://news.google.com/rss/topics/CAAqJQgKIh9DQkFTRVFvSUwyMHZNREpqWm5RU0JXVnVMVWRDS0FBUAE?ceid=IE:en&hl=en-IE&gl=IE';
  
  return new Promise((resolve) => {
    console.log('🔍 Testing redirected Google News RSS feed...');
    console.log(`URL: ${redirectedUrl}`);
    
    const req = https.get(redirectedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 15000
    }, (res) => {
      console.log(`📊 Status Code: ${res.statusCode}`);
      console.log(`📋 Content-Type: ${res.headers['content-type']}`);
      
      if (res.statusCode === 302 || res.statusCode === 301) {
        console.log(`🔄 Redirect Location: ${res.headers.location}`);
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`📄 Response length: ${data.length} characters`);
        
        if (data.length > 0) {
          console.log('\n📄 Response preview (first 1000 chars):');
          console.log(data.substring(0, 1000));
          
          // 检查是否是有效RSS
          if (data.includes('<rss') || data.includes('<channel>') || data.includes('<item>')) {
            console.log('\n✅ Looks like valid RSS feed!');
            
            // 提取链接
            const linkMatches = data.match(/<link[^>]*>([^<]+)<\/link>/g);
            if (linkMatches) {
              console.log(`\n🔗 Found ${linkMatches.length} links in RSS feed:`);
              linkMatches.slice(0, 5).forEach((link, i) => {
                const url = link.replace(/<[^>]+>/g, '').trim();
                console.log(`  ${i + 1}. ${url}`);
              });
            }
            
            // 也查找CDATA中的链接
            const cdataMatches = data.match(/<!\[CDATA\[(.*?)\]\]>/g);
            if (cdataMatches) {
              console.log(`\n📰 Found ${cdataMatches.length} CDATA sections, checking for links...`);
              cdataMatches.slice(0, 3).forEach((cdata, i) => {
                const content = cdata.replace(/<!\[CDATA\[|\]\]>/g, '');
                const urlPattern = /https?:\/\/[^\s<>"]+/g;
                const urls = content.match(urlPattern);
                if (urls) {
                  console.log(`  CDATA ${i + 1} URLs: ${urls.slice(0, 2).join(', ')}`);
                }
              });
            }
          } else {
            console.log('\n❌ Not a valid RSS feed');
          }
        }
        
        resolve(data);
      });
    });
    
    req.on('error', (err) => {
      console.log(`❌ Request Error: ${err.message}`);
      resolve('');
    });
    
    req.on('timeout', () => {
      console.log(`⏰ Request Timeout`);
      req.destroy();
      resolve('');
    });
  });
}

testRedirectedRSS().catch(console.error);
