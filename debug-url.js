const { debugDecodeUrl } = require('./utils/puppeteerResolver.js');

// Test URL from the failed attempts
const testUrl = 'https://news.google.com/read/CBMi4AFBVV95cUxOMXlvMDdZa3hXUmw1Qnp3Vm5DMEtnTVk5Xy0tNG9GX3FLV1JzNGgxOWJ6TUluNmFzbndOVXp4Q1A5VzIxeXZGbXZQSjdROW82dmZvLWNJWWJzRzdkNnQ3SU82djIxcDUyME4wNmpUMzl3SUNEZUVrNXFFNVBDM0QzZl9NczZSRkVkVW1pYzZKeXNJWG9XbzIwcUkwYWdCdjdyUGRHQ2hGRjV6dFpLMXlSTGhwZnpvTk1sTTF2LVZlU0x6SWFfZGNvNmVmc1hNcER3RTQxUmdGUzE2SUE4YmdRVjgyVFctOVptS1RQejQ1Y1k0eFBNRU9GNWRjNzAzV3pBWVNTMDZWWlhzRFFOT01SMQ?oc=5';

console.log('Debugging Google News URL structure...\n');
debugDecodeUrl(testUrl);

// Now let's try to decode the inner string as well
function testSecondLayerDecoding() {
    console.log('\n=== Testing second layer decoding ===');
    
    const urlParts = testUrl.split('/');
    let encodedPart = urlParts[urlParts.length - 1].split('?')[0];
    
    let base64String = encodedPart.replace(/-/g, '+').replace(/_/g, '/');
    while (base64String.length % 4) {
        base64String += '=';
    }
    
    const buffer = Buffer.from(base64String, 'base64');
    
    // Extract the long string we found
    const innerString = buffer.slice(5).toString('utf8');
    console.log('Inner string length:', innerString.length);
    console.log('Inner string:', innerString);
    
    // Try to decode this as Base64 as well
    try {
        let innerBase64 = innerString.replace(/-/g, '+').replace(/_/g, '/');
        while (innerBase64.length % 4) {
            innerBase64 += '=';
        }
        
        const innerBuffer = Buffer.from(innerBase64, 'base64');
        console.log('Inner buffer length:', innerBuffer.length);
        console.log('Inner buffer (hex):', innerBuffer.slice(0, 100).toString('hex'));
        console.log('Inner buffer (utf8):', innerBuffer.toString('utf8').replace(/[^\x20-\x7E]/g, '.'));
        
        // Look for HTTP in the inner buffer
        const httpIndex = innerBuffer.indexOf('http');
        console.log('HTTP found in inner buffer at index:', httpIndex);
        
        if (httpIndex !== -1) {
            // Extract potential URL
            let endIndex = httpIndex;
            for (let i = httpIndex; i < innerBuffer.length; i++) {
                const byte = innerBuffer[i];
                if (byte === 0x00 || byte === 0x09 || byte === 0x0A || byte === 0x12 || byte === 0x22 || byte === 0x20 || byte > 0x7E) {
                    endIndex = i;
                    break;
                }
            }
            const potentialUrl = innerBuffer.toString('utf-8', httpIndex, endIndex === httpIndex ? innerBuffer.length : endIndex);
            console.log('Potential URL found:', potentialUrl);
        }
        
    } catch (e) {
        console.log('Second layer decoding failed:', e.message);
    }
}

testSecondLayerDecoding();
