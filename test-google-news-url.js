const https = require('https');
const http = require('http');

// 测试从调试输出中获取的实际URL
const testUrls = [
  'https://news.google.com/read/CBMi4AFBVV95cUxNVkNhWTBQSUIyaTFGUjlNYmVhQWR2cHhma1VTZXc5ZjMwbEQtN2p5VmVvVV9QaWdraERCaHBWYmpoVFJiaDJocjFJZEozRUh0UVVOTDJUbDJWb3NZVkEtQ3JHTVJmYkRaMGVCVjMtMERXZWVyNTVWN2kwLVY3cjJSTzJBRXhRUV9acko5ZHVzM2JzdGdubUVBajl0WUhDTjB5dk5NTUwwZUV1d2VwZkdILWQxWkJKWklWSy1lQnlGeTJacWZ5dV9nN0p1cFBxTmhsVE5fdWh3S3g0aTNFOGxGVEVERWNRcWpOTXVQTEl0Wm9BOHhyMGQtTExJU1pwb1JhVHJhdWlhOWxfOFJMMnNGN0h2RXBfMkN5SUlKOGRJdzBSSFJJV2ROUG1xVWpvUk5rdUpNbDVjeTBVckRrTWt5M1lvX1pPbUtGcUhrY1diRURoSEJUNU15Q2VGREhJOGdCMFNJOWxPa1FTc0I2c1NHOElJSTFYdkRwempoeFVlS29zdnpQUTRBM3R5MHJJZHN3S0JIaTJaN0x6VGtOLUdtNWhwVXBqOFNyQWJmTGJzQTNEUE9KSTBKeGZVdEJWTWlGMGZuNFdXN0hKRzRJNjU3MW1pM080QWdCUURGNXZPM01PY1REdVpaWWF5NklyTENHZTBUWGhwbE1sRDY5QU1oWkFoQVhiWjM5Zk12R1diN0dHdEVSTlVjUGJqSEoxblZPN3pCOG9GMWJnNWtZUDJoMnlEd0I4ZmFDcGlnd1VmbFhtSzhSdU1URVVBekNhdGY2VmdSV2dETlAwWElGOTNQaFJIOW01ak9WQXY4aTZpWGVfOG13RjRjdGJOelNpaGxMN1hOUjJseWJDcndpSnI4Yk1XMXE0QXNCMDhGZE5aV1F5c29HTGpKUElydHhZUFJkOGhpMGhOanBBRERtZUNsZGprNHlFOVREcWNmWWpRUWRCM1FtU0xZTldLS2NfRUNfUVRGWkpOQm1YazJTZ2pmWVYxMUIyRE14ZGl3TGVXMjl3bjU2dlU5alBYVHBPMFRUbUVCM2VGS3p4UXNhY0ZIWE11dTZxR1NPRUhGd1pLUUdBOFNBdGswTEhWZGJFMWZhRDA0MGZQSFE4NjdjQ1E',
  // 简化测试：不带参数的base URL
  'https://news.google.com',
];

async function testUrl(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https:') ? https : http;
    
    console.log(`\n🔍 Testing URL: ${url.substring(0, 100)}...`);
    
    const req = protocol.get(url, {
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
      console.log(`📋 Headers:`, JSON.stringify(res.headers, null, 2));
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`📄 Response preview: ${data.substring(0, 200)}...`);
        resolve({ statusCode: res.statusCode, headers: res.headers, data: data.substring(0, 500) });
      });
    });
    
    req.on('error', (err) => {
      console.log(`❌ Request Error: ${err.message}`);
      resolve({ error: err.message });
    });
    
    req.on('timeout', () => {
      console.log(`⏰ Request Timeout`);
      req.destroy();
      resolve({ error: 'timeout' });
    });
  });
}

async function main() {
  console.log('🧪 Testing Google News URLs...\n');
  
  for (const url of testUrls) {
    await testUrl(url);
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒延迟
  }
}

main().catch(console.error);
