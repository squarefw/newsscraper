/**
 * Google News URL Resolver - 基于Grok成功方案
 * 专门用于解码Google News重定向链接
 */

/**
 * 解码单个Google News URL（基于Grok成功方案）
 */
function decodeGoogleNewsUrl(encodedUrl) {
    console.log(`🔍 Attempting to decode: ${encodedUrl.substring(0, 80)}...`);
    
    try {
        // 常量定义
        const ENCODED_URL_PREFIX = "https://news.google.com/rss/articles/";
        const READ_URL_PREFIX = "https://news.google.com/read/";
        
        // 正则表达式
        const ENCODED_URL_RE = new RegExp(`^${ENCODED_URL_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(.+?)(\\?|$)`, 'i');
        const READ_URL_RE = new RegExp(`^${READ_URL_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(.+?)(\\?|$)`, 'i');
        const DECODED_URL_RE = /^[\x08\x13"].+?(http[^\xd2]+)\xd2\x01/;
        
        // 确定URL类型并提取编码部分
        let encodedText = '';
        if (encodedUrl.startsWith(ENCODED_URL_PREFIX)) {
            const match = encodedUrl.match(ENCODED_URL_RE);
            if (!match) {
                throw new Error("无法提取RSS articles编码部分");
            }
            encodedText = match[1];
        } else if (encodedUrl.startsWith(READ_URL_PREFIX)) {
            const match = encodedUrl.match(READ_URL_RE);
            if (!match) {
                throw new Error("无法提取read编码部分");
            }
            encodedText = match[1];
        } else {
            throw new Error("无效的Google News链接格式");
        }
        
        console.log(`🔍 Extracted encoded part: ${encodedText.substring(0, 50)}...`);
        
        // 清理编码文本
        encodedText = encodedText.replace(/[^A-Za-z0-9\-_]/g, '');
        // 转换为标准base64
        encodedText = encodedText.replace(/-/g, '+').replace(/_/g, '/');
        
        // 计算padding
        const paddingLength = (4 - (encodedText.length % 4)) % 4;
        encodedText += '='.repeat(paddingLength);
        
        // Base64解码
        let decodedText;
        try {
            if (typeof Buffer !== 'undefined') {
                decodedText = Buffer.from(encodedText, 'base64').toString('binary');
            } else {
                decodedText = atob(encodedText);
            }
        } catch (e) {
            throw new Error(`Base64解码失败: ${e.message}`);
        }
        
        // 提取原始URL
        const decodedMatch = decodedText.match(DECODED_URL_RE);
        if (!decodedMatch) {
            throw new Error("无法从解码数据中提取URL");
        }
        
        const originalUrl = decodedMatch[1];
        console.log(`✅ Successfully decoded: ${originalUrl}`);
        return originalUrl;
        
    } catch (error) {
        console.log(`❌ Decoding failed: ${error.message}`);
        return null;
    }
}

/**
 * 解码多个Google News URLs - 混合方案
 * 对于短URL使用解码器，对于长URL返回RSS元数据URL
 * @param {string[]} urls An array of encoded Google News URLs.
 * @param {Object} options Options including RSS metadata for fallback
 * @returns {Promise<string[]>} A promise that resolves to an array of decoded URLs.
 */
async function resolveGoogleNewsUrls(urls, options = {}) {
    if (!urls || urls.length === 0) {
        return [];
    }

    console.log(`   Decoding ${urls.length} Google News links using hybrid approach...`);
    const resolvedLinks = new Set();
    let successCount = 0;
    let fallbackCount = 0;

    for (const url of urls) {
        if (url.includes('/stories/')) {
             process.stdout.write(`    - Skipping story collection: ${url.slice(0, 80)}...\n`);
             continue;
        }
        
        process.stdout.write(`    - Decoding: ${url.slice(0, 80)}... `);
        
        // 尝试解码
        const decodedUrl = decodeGoogleNewsUrl(url);
        if (decodedUrl) {
            process.stdout.write(`✅\n`);
            resolvedLinks.add(decodedUrl);
            successCount++;
        } else {
            // 解码失败，检查是否为长URL（通常 > 150 字符表示是复杂编码）
            const isLongUrl = url.length > 150;
            if (isLongUrl) {
                process.stdout.write(`📋 (Long URL - using as-is)\n`);
                resolvedLinks.add(url); // 对于长URL，直接返回原URL，因为RSS已提供元数据
                fallbackCount++;
            } else {
                process.stdout.write(`❌ (Failed)\n`);
            }
        }
    }
    
    console.log(`   Finished processing. Decoded: ${successCount}, Fallback: ${fallbackCount}, Total valid: ${resolvedLinks.size}`);
    console.log(`   Success rate: ${Math.round((successCount / urls.length) * 100)}%, Hybrid coverage: ${Math.round(((successCount + fallbackCount) / urls.length) * 100)}%`);
    return Array.from(resolvedLinks);
}

/**
 * Debug function (stub for compatibility)
 */
function debugDecodeUrl(encodedUrl) {
    console.log(`Debug decoding: ${encodedUrl}`);
    return decodeGoogleNewsUrl(encodedUrl);
}

module.exports = { resolveGoogleNewsUrls, debugDecodeUrl };
