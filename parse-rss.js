const https = require('https');

// 使用手动解析RSS
async function parseGoogleNewsRSS() {
  const redirectedUrl = 'https://news.google.com/rss/topics/CAAqJQgKIh9DQkFTRVFvSUwyMHZNREpqWm5RU0JXVnVMVWRDS0FBUAE?ceid=IE:en&hl=en-IE&gl=IE';
  
  return new Promise((resolve) => {
    console.log('🔍 Parsing Google News RSS feed...');
    
    const req = https.get(redirectedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
      timeout: 15000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`📄 Received ${data.length} characters of RSS data`);
        
        // 手动解析RSS项目
        const itemPattern = /<item[^>]*>(.*?)<\/item>/gs;
        const items = [...data.matchAll(itemPattern)];
        
        console.log(`\n📰 Found ${items.length} news items`);
        
        items.slice(0, 5).forEach((item, i) => {
          const itemContent = item[1];
          
          // 提取各个字段
          const title = itemContent.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/s)?.[1] || 
                       itemContent.match(/<title>(.*?)<\/title>/s)?.[1] || 'No title';
          
          const link = itemContent.match(/<link>(.*?)<\/link>/s)?.[1] || 'No link';
          
          const pubDate = itemContent.match(/<pubDate>(.*?)<\/pubDate>/s)?.[1] || 'No date';
          
          const source = itemContent.match(/<source[^>]*>(.*?)<\/source>/s)?.[1] || 'No source';
          
          console.log(`\n${i + 1}. ${title}`);
          console.log(`   📅 ${pubDate}`);
          console.log(`   📰 ${source}`);
          console.log(`   🔗 ${link.substring(0, 100)}...`);
          
          // 检查链接类型
          if (link.includes('/rss/articles/')) {
            console.log(`   ⚠️  This is still a Google News redirect link`);
          } else if (link.includes('http')) {
            console.log(`   ✅ This looks like a direct article link`);
          }
        });
        
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

parseGoogleNewsRSS().catch(console.error);
