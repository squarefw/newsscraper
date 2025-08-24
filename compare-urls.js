// Compare working vs non-working URLs
const workingUrl = 'https://news.google.com/rss/articles/CBMiSGh0dHBzOi8vdGVjaGNydW5jaC5jb20vMjAyMi8xMC8yNy9uZXcteW9yay1wb3N0LWhhY2tlZC1vZmZlbnNpdmUtdHdlZXRzL9IBAA?oc=5';
const longUrl = 'https://news.google.com/rss/articles/CBMi4AFBVV95cUxOMXlvMDdZa3hXUmw1Qnp3Vm5DMEtnTVk5Xy00bnVicG9IZzczWDFVaHRqQmZWQnNoaWZrODBjcnZLTFZWYXJsT1J1SmZ2TUdyN0R2OG9pWE1OTl9WNkFjelZ4MXQxM1h6Qkk0YzNqVnVCV28yT0tvYk5Cb0JsdmNTS3lMdEJESW9fdVVGTXNvVFhZT3A5Uk5PR0xXbzllNzBIMklYTXI0Z3R1WllsQWIwcmFIYzZLUno2NUFaem5jd09YbjZRSG03azdtV25STkE0SDFzMDVCODZVRFdHWklRcg?oc=5';

function analyzeUrl(url, name) {
    console.log(`\n=== ${name} ===`);
    
    const ENCODED_URL_PREFIX = "https://news.google.com/rss/articles/";
    const ENCODED_URL_RE = new RegExp(`^${ENCODED_URL_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(.+?)(\\?|$)`, 'i');
    
    const match = url.match(ENCODED_URL_RE);
    let encodedText = match[1];
    
    console.log('Original length:', encodedText.length);
    console.log('First 50 chars:', encodedText.substring(0, 50));
    
    // Clean and decode
    encodedText = encodedText.replace(/[^A-Za-z0-9\-_]/g, '');
    encodedText = encodedText.replace(/-/g, '+').replace(/_/g, '/');
    const paddingLength = (4 - (encodedText.length % 4)) % 4;
    encodedText += '='.repeat(paddingLength);
    
    try {
        const decodedText = Buffer.from(encodedText, 'base64').toString('binary');
        console.log('Decoded length:', decodedText.length);
        console.log('First 100 chars (escaped):', JSON.stringify(decodedText.substring(0, 100)));
        
        // Look for any HTTP pattern
        const httpMatch = decodedText.match(/(https?:\/\/[^\s\x00-\x1f\x7f-\xff]+)/);
        console.log('HTTP URL found:', httpMatch ? httpMatch[1] : 'None');
        
        // Check if it starts with the specific pattern
        const startsWithPattern = /^[\x08\x13"]/.test(decodedText);
        console.log('Starts with \\x08\\x13" pattern:', startsWithPattern);
        
        // Look for the ending pattern \\xd2\\x01
        const hasEndPattern = decodedText.includes('\xd2\x01');
        console.log('Contains \\xd2\\x01 pattern:', hasEndPattern);
        
    } catch (e) {
        console.log('Decode error:', e.message);
    }
}

analyzeUrl(workingUrl, 'WORKING SHORT URL');
analyzeUrl(longUrl, 'FAILING LONG URL');
