const https = require('https');
const cheerio = require('cheerio');

// 测试直接访问Google News首页，看看实际的链接结构
async function fetchGoogleNewsHomepage() {
  return new Promise((resolve) => {
    console.log('🔍 Fetching Google News homepage...');
    
    const req = https.get('https://news.google.com/home?hl=en-US&gl=US&ceid=US:en', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 10000
    }, (res) => {
      console.log(`📊 Status Code: ${res.statusCode}`);
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`📄 Response length: ${data.length} characters`);
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

async function analyzeGoogleNewsStructure() {
  const html = await fetchGoogleNewsHomepage();
  
  if (!html) {
    console.log('❌ Failed to fetch Google News homepage');
    return;
  }
  
  const $ = cheerio.load(html);
  
  console.log('\n🔍 Analyzing link structure...');
  
  // 查找所有链接
  const allLinks = [];
  $('a[href]').each((i, elem) => {
    const href = $(elem).attr('href');
    if (href) {
      allLinks.push(href);
    }
  });
  
  console.log(`📊 Total links found: ${allLinks.length}`);
  
  // 分析链接模式
  const linkPatterns = {};
  allLinks.forEach(link => {
    if (link.startsWith('./')) {
      const pattern = link.split('/')[1];
      linkPatterns[pattern] = (linkPatterns[pattern] || 0) + 1;
    } else if (link.startsWith('http')) {
      const domain = new URL(link).hostname;
      linkPatterns[domain] = (linkPatterns[domain] || 0) + 1;
    } else if (link.startsWith('/')) {
      const pattern = link.split('/')[1];
      linkPatterns['/' + pattern] = (linkPatterns['/' + pattern] || 0) + 1;
    }
  });
  
  console.log('\n📋 Link patterns:');
  Object.entries(linkPatterns)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([pattern, count]) => {
      console.log(`  ${pattern}: ${count}`);
    });
  
  // 查找新闻相关的链接
  const newsLinks = allLinks.filter(link => 
    link.includes('read/') || 
    link.includes('articles/') || 
    link.includes('stories/') ||
    link.includes('publications/')
  );
  
  console.log(`\n📰 News-related links: ${newsLinks.length}`);
  newsLinks.slice(0, 5).forEach((link, i) => {
    console.log(`  ${i + 1}. ${link}`);
  });
  
  // 查看页面的实际内容结构
  console.log('\n🔍 Page structure analysis:');
  console.log(`  Title: ${$('title').text()}`);
  console.log(`  Articles with text: ${$('article').length}`);
  console.log(`  Divs with data attributes: ${$('div[data-n-tid]').length}`);
  console.log(`  Links with jslog: ${$('a[jslog]').length}`);
}

analyzeGoogleNewsStructure().catch(console.error);
