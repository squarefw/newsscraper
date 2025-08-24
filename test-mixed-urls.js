// 测试混合短URL和长URL
const { resolveGoogleNewsUrls } = require('./utils/puppeteerResolver_new');

async function testMixedUrls() {
  console.log('🧪 Testing mixed short and long URLs...\n');
  
  // 混合测试：1个短URL（已知可解码）+ 2个长URL（无法解码但保留）
  const testUrls = [
    'https://news.google.com/rss/articles/CBMiSGh0dHBzOi8vdGVjaGNydW5jaC5jb20vMjAyMi8xMC8yNy9uZXcteW9yay1wb3N0LWhhY2tlZC1vZmZlbnNpdmUtdHdlZXRzL9IBAA?oc=5', // 短URL，应该能解码
    'https://news.google.com/rss/articles/CBMi4AFBVV95cUxOMXlvMDdZa3hXUmw1Qnp3Vm5DMEtnTVk5Xy00bnVicG9IZzczWDFVaHRqQmZWQnNoaWZrODBjcnZLTFZWYXJsT1J1SmZ2TUdyN0R2OG9pWE1OTl9WNkFjelZ4MXQxM1h6Qkk0YzNqVnVCV28yT0tvYk5Cb0JsdmNTS3lMdEJESW9fdVVGTXNvVFhZT3A5Uk5PR0xXbzllNzBIMklYTXI0Z3R1WllsQWIwcmFIYzZLUno2NUFaem5jd09YbjZRSG03azdtV25STkE0SDFzMDVCODZVRFdHWklRcg?oc=5', // 长URL，保留原样
    'https://news.google.com/rss/articles/CBMid0FVX3lxTFBLenh4b1JXeUVNVjhmemVmTEw3RjRVUVNBYU55cVZHYnE1UG93ZVdNSjFTbFVuNGx2Qjd3N25fMVkyMzJfaDNQRlhBYkNmWmE0T0o0NGduYnRGNmZlbWdaU01UOEVXNjVLQTZKcG5Tdkg0MERsVXRN0gFGQVVfeXFMTVhNdlp6bGY3R3N0UnBUdDc0UFgtQW5jdUFCNktheV9nYTFha0FKQmY2R0RQaUZhT3ZZWWI5SzBQWmJPTVN0Zw?oc=5' // 长URL，保留原样
  ];
  
  const results = await resolveGoogleNewsUrls(testUrls);
  
  console.log(`\n📊 Mixed Test Results:`);
  console.log(`Input URLs: ${testUrls.length}`);
  console.log(`Output URLs: ${results.length}`);
  console.log(`Hybrid Success Rate: ${Math.round((results.length / testUrls.length) * 100)}%\n`);
  
  results.forEach((url, i) => {
    const isDecoded = !url.includes('news.google.com');
    console.log(`${i + 1}. ${isDecoded ? '✅ DECODED' : '📋 RSS-ORIGINAL'}: ${url.substring(0, 100)}...`);
  });
}

testMixedUrls().catch(console.error);
