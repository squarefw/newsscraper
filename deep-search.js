const longUrl = 'https://news.google.com/rss/articles/CBMi4AFBVV95cUxOMXlvMDdZa3hXUmw1Qnp3Vm5DMEtnTVk5Xy00bnVicG9IZzczWDFVaHRqQmZWQnNoaWZrODBjcnZLTFZWYXJsT1J1SmZ2TUdyN0R2OG9pWE1OTl9WNkFjelZ4MXQxM1h6Qkk0YzNqVnVCV28yT0tvYk5Cb0JsdmNTS3lMdEJESW9fdVVGTXNvVFhZT3A5Uk5PR0xXbzllNzBIMklYTXI0Z3R1WllsQWIwcmFIYzZLUno2NUFaem5jd09YbjZRSG03azdtV25STkE0SDFzMDVCODZVRFdHWklRcg?oc=5';

const ENCODED_URL_PREFIX = "https://news.google.com/rss/articles/";
const ENCODED_URL_RE = new RegExp(`^${ENCODED_URL_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(.+?)(\\?|$)`, 'i');

const match = longUrl.match(ENCODED_URL_RE);
let encodedText = match[1];

encodedText = encodedText.replace(/[^A-Za-z0-9\-_]/g, '');
encodedText = encodedText.replace(/-/g, '+').replace(/_/g, '/');
const paddingLength = (4 - (encodedText.length % 4)) % 4;
encodedText += '='.repeat(paddingLength);

const decodedText = Buffer.from(encodedText, 'base64').toString('binary');

console.log('🔍 Searching entire decoded content for URLs...');
console.log('Full decoded length:', decodedText.length);

// Search for any string that looks like a domain
const domainPattern = /[a-zA-Z0-9][\w\-\.]*\.(com|org|net|edu|gov|info|co|uk|cn|jp|de|fr|br|au|ca|in|ru|it|nl|es|pl|se|no|dk|fi|be|ch|at|cz|gr|pt|hu|ro|bg|hr|sk|si|lt|lv|ee|mt|cy|lu|ie|is|li|mc|sm|ad|va|md|ua|by|rs|me|mk|al|ba|xk|tr|ge|am|az|kz|kg|tj|tm|uz|af|pk|bd|lk|np|bt|mv|mm|th|la|kh|vn|my|sg|id|ph|bn|tl|fm|pw|mh|ki|tv|nr|tk|ws|vu|sb|fj|pg|nc|nz)/gi;
const domains = decodedText.match(domainPattern);
console.log('Domains found:', domains);

// Search for specific patterns that might indicate URLs
const urlPatterns = [
    /[a-z]+\.[a-z]{2,}/gi,
    /www\.[^\s]+/gi,
    /\.com[^\s]*/gi,
    /\.org[^\s]*/gi
];

urlPatterns.forEach((pattern, i) => {
    const matches = decodedText.match(pattern);
    console.log(`Pattern ${i + 1} (${pattern}):`, matches);
});

// Look at the raw bytes in hex to understand the structure
console.log('\n🔍 First 50 bytes in hex:');
const hexBytes = [];
for (let i = 0; i < Math.min(50, decodedText.length); i++) {
    hexBytes.push(decodedText.charCodeAt(i).toString(16).padStart(2, '0'));
}
console.log(hexBytes.join(' '));

// Look for the AU_ pattern which seems to be at the start
console.log('\n🔍 Looking for AU_ pattern and what follows...');
const auIndex = decodedText.indexOf('AU_');
if (auIndex !== -1) {
    console.log('AU_ found at position:', auIndex);
    console.log('Text around AU_:', JSON.stringify(decodedText.substring(auIndex - 5, auIndex + 50)));
}
