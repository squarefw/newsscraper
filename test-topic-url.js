const https = require('https');
const cheerio = require('cheerio');

// 测试实际的Google News主题URL
async function testGoogleNewsTopicUrl() {
  const testUrl = 'https://news.google.com/topics/CAAqJQgKIh9DQkFTRVFvSUwyMHZNREpqWm5RU0JXVnVMVWRDS0FBUAE?ceid=IE:en&oc=3';
  
  return new Promise((resolve) => {
    console.log('🔍 Testing Google News topic URL...');
    console.log(`URL: ${testUrl}`);
    
    const req = https.get(testUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://news.google.com/',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 15000
    }, (res) => {
      console.log(`📊 Status Code: ${res.statusCode}`);
      console.log(`📋 Content-Type: ${res.headers['content-type']}`);
      console.log(`📏 Content-Length: ${res.headers['content-length']}`);
      
      if (res.statusCode === 302 || res.statusCode === 301) {
        console.log(`🔄 Redirect Location: ${res.headers.location}`);
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`📄 Response length: ${data.length} characters`);
        
        // 查看响应的前1000个字符，看看是什么内容
        console.log('\n📄 Response preview:');
        console.log(data.substring(0, 1000));
        
        // 如果是HTML，分析链接结构
        if (data.includes('<html') || data.includes('<!DOCTYPE')) {
          analyzeLinksInResponse(data);
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

function analyzeLinksInResponse(html) {
  console.log('\n🔍 Analyzing links in response...');
  
  const $ = cheerio.load(html);
  
  // 查找所有包含read/的链接
  const readLinks = [];
  $('a[href*="read/"]').each((i, elem) => {
    const href = $(elem).attr('href');
    if (href) {
      readLinks.push(href);
    }
  });
  
  console.log(`📰 Found ${readLinks.length} links with "read/"`);
  
  // 显示前5个
  readLinks.slice(0, 5).forEach((link, i) => {
    console.log(`  ${i + 1}. ${link}`);
  });
  
  // 查找所有相对链接
  const relativeLinks = [];
  $('a[href^="./"]').each((i, elem) => {
    const href = $(elem).attr('href');
    if (href) {
      relativeLinks.push(href);
    }
  });
  
  console.log(`🔗 Found ${relativeLinks.length} relative links starting with "./" `);
  
  // 显示前5个
  relativeLinks.slice(0, 5).forEach((link, i) => {
    console.log(`  ${i + 1}. ${link}`);
  });
  
  // 检查是否有文章标题
  const headlines = [];
  $('h3, h4, .article-title, [data-testid="headline"]').each((i, elem) => {
    const text = $(elem).text().trim();
    if (text && text.length > 10) {
      headlines.push(text);
    }
  });
  
  console.log(`📰 Found ${headlines.length} potential headlines`);
  headlines.slice(0, 3).forEach((headline, i) => {
    console.log(`  ${i + 1}. ${headline.substring(0, 100)}...`);
  });
}

testGoogleNewsTopicUrl().catch(console.error);
