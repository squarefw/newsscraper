// 测试修改后的解码器
const { resolveGoogleNewsUrls } = require('./utils/puppeteerResolver_new');

async function testNewDecoder() {
  console.log('🧪 Testing new Grok-based decoder...\n');
  
  // 测试一些从RSS获取的真实链接
  const testUrls = [
    'https://news.google.com/rss/articles/CBMi4AFBVV95cUxOMXlvMDdZa3hXUmw1Qnp3Vm5DMEtnTVk5Xy00bnVicG9IZzczWDFVaHRqQmZWQnNoaWZrODBjcnZLTFZWYXJsT1J1SmZ2TUdyN0R2OG9pWE1OTl9WNkFjelZ4MXQxM1h6Qkk0YzNqVnVCV28yT0tvYk5Cb0JsdmNTS3lMdEJESW9fdVVGTXNvVFhZT3A5Uk5PR0xXbzllNzBIMklYTXI0Z3R1WllsQWIwcmFIYzZLUno2NUFaem5jd09YbjZRSG03azdtV25STkE0SDFzMDVCODZVRFdHWklRcg?oc=5',
    'https://news.google.com/rss/articles/CBMid0FVX3lxTFBLenh4b1JXeUVNVjhmemVmTEw3RjRVUVNBYU55cVZHYnE1UG93ZVdNSjFTbFVuNGx2Qjd3N25fMVkyMzJfaDNQRlhBYkNmWmE0T0o0NGduYnRGNmZlbWdaU01UOEVXNjVLQTZKcG5Tdkg0MERsVXRN0gFGQVVfeXFMTVhNdlp6bGY3R3N0UnBUdDc0UFgtQW5jdUFCNktheV9nYTFha0FKQmY2R0RQaUZhT3ZZWWI5SzBQWmJPTVN0Zw?oc=5',
    'https://news.google.com/rss/articles/CBMisgFBVV95cUxNV3dadTNPZjNiRjhQU2VlNWw0cHNpYUN0aXhBNnFSNzZ6NE9TZVRJZUdmUHNnNjEyNzEzLXlYTDNlWTI2REJmWGIyRjlYRmJMbzlkZDBzT0lzVDRKckhEUjMzSGFBVFdKM3R0RkEwYWVYVUd4Y05LY0tLYjBfaDBSRXBnTk5raHZwNVdVRWg3VDhlVExYVGxHSHFzQzFIMmY4akVaZVBEMkZ5ZFV6NFlGQlV3?oc=5'
  ];
  
  const results = await resolveGoogleNewsUrls(testUrls);
  
  console.log(`\n📊 Test Results:`);
  console.log(`Input URLs: ${testUrls.length}`);
  console.log(`Decoded URLs: ${results.length}`);
  console.log(`Success Rate: ${Math.round((results.length / testUrls.length) * 100)}%\n`);
  
  results.forEach((url, i) => {
    console.log(`${i + 1}. ${url}`);
  });
}

testNewDecoder().catch(console.error);
