const { debugDecodeUrl } = require('./utils/puppeteerResolver_new');

// Test with the exact same URL that works in groksample.js
const testUrl = "https://news.google.com/rss/articles/CBMiSGh0dHBzOi8vdGVjaGNydW5jaC5jb20vMjAyMi8xMC8yNy9uZXcteW9yay1wb3N0LWhhY2tlZC1vZmZlbnNpdmUtdHdlZXRzL9IBAA?oc=5";

console.log('🧪 Testing single URL that works in groksample.js:');
console.log('Input:', testUrl);
console.log('');

const result = debugDecodeUrl(testUrl);
console.log('');
console.log('Result:', result);
console.log('Expected: https://techcrunch.com/2022/10/27/new-york-post-hacked-offensive-tweets/');
