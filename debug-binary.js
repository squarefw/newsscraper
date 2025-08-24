const testUrl = 'https://news.google.com/rss/articles/CBMi4AFBVV95cUxOMXlvMDdZa3hXUmw1Qnp3Vm5DMEtnTVk5Xy00bnVicG9IZzczWDFVaHRqQmZWQnNoaWZrODBjcnZLTFZWYXJsT1J1SmZ2TUdyN0R2OG9pWE1OTl9WNkFjelZ4MXQxM1h6Qkk0YzNqVnVCV28yT0tvYk5Cb0JsdmNTS3lMdEJESW9fdVVGTXNvVFhZT3A5Uk5PR0xXbzllNzBIMklYTXI0Z3R1WllsQWIwcmFIYzZLUno2NUFaem5jd09YbjZRSG03azdtV25STkE0SDFzMDVCODZVRFdHWklRcg?oc=5';

console.log('🔍 Deep debugging long URL...');

const ENCODED_URL_PREFIX = "https://news.google.com/rss/articles/";
const ENCODED_URL_RE = new RegExp(`^${ENCODED_URL_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(.+?)(\\?|$)`, 'i');

// Extract encoded part
const match = testUrl.match(ENCODED_URL_RE);
let encodedText = match[1];

console.log('Original encoded text length:', encodedText.length);
console.log('Original encoded text (first 100 chars):', encodedText.substring(0, 100));

// Clean it
encodedText = encodedText.replace(/[^A-Za-z0-9\-_]/g, '');
encodedText = encodedText.replace(/-/g, '+').replace(/_/g, '/');

const paddingLength = (4 - (encodedText.length % 4)) % 4;
encodedText += '='.repeat(paddingLength);

console.log('Cleaned encoded text length:', encodedText.length);
console.log('Cleaned encoded text (first 100 chars):', encodedText.substring(0, 100));

// Decode
try {
    const decodedText = Buffer.from(encodedText, 'base64').toString('binary');
    console.log('Decoded binary length:', decodedText.length);
    console.log('Decoded binary (first 200 chars, escaped):', JSON.stringify(decodedText.substring(0, 200)));
    
    // Try different regex patterns
    console.log('\n🔍 Testing different regex patterns:');
    
    const patterns = [
        /^[\x08\x13"].+?(http[^\xd2]+)\xd2\x01/,
        /(https?:\/\/[^\x00-\x1f\x7f-\xff\s]+)/,
        /(https?:\/\/[^\\s]+)/,
        /https?:\/\/[^\s<>"{}|\\^`[\]]+/g
    ];
    
    patterns.forEach((pattern, i) => {
        const match = decodedText.match(pattern);
        console.log(`Pattern ${i + 1}:`, pattern);
        console.log(`Result:`, match ? match[1] || match[0] : 'No match');
        console.log('');
    });
    
} catch (e) {
    console.error('Decoding error:', e.message);
}
