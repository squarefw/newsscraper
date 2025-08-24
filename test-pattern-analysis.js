const { debugDecodeUrl } = require('./utils/puppeteerResolver_new');

// Test with actual URLs from RSS feed
const testUrls = [
  'https://news.google.com/rss/articles/CBMi4AFBVV95cUxOMXlvMDdZa3hXUmw1Qnp3Vm5DMEtnTVk5Xy00bnVicG9IZzczWDFVaHRqQmZWQnNoaWZrODBjcnZLTFZWYXJsT1J1SmZ2TUdyN0R2OG9pWE1OTl9WNkFjelZ4MXQxM1h6Qkk0YzNqVnVCV28yT0tvYk5Cb0JsdmNTS3lMdEJESW9fdVVGTXNvVFhZT3A5Uk5PR0xXbzllNzBIMklYTXI0Z3R1WllsQWIwcmFIYzZLUno2NUFaem5jd09YbjZRSG03azdtV25STkE0SDFzMDVCODZVRFdHWklRcg?oc=5',
  'https://news.google.com/rss/articles/CBMiSGh0dHBzOi8vdGVjaGNydW5jaC5jb20vMjAyMi8xMC8yNy9uZXcteW9yay1wb3N0LWhhY2tlZC1vZmZlbnNpdmUtdHdlZXRzL9IBAA?oc=5'
];

console.log('🧪 Testing URLs with different patterns:');

testUrls.forEach((url, i) => {
  console.log(`\n--- Test ${i + 1} ---`);
  console.log('Input:', url.substring(0, 100) + '...');
  
  const result = debugDecodeUrl(url);
  console.log('Result:', result || 'FAILED');
});
