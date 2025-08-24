/**
 * Google News URL Resolver - 增强版包装器
 * 使用多种策略解码Google News重定向链接
 */

// 导入增强版解析器
const { 
    decodeGoogleNewsUrlStatic,
    fetchRedirectUrl,
    getOriginalNewsLinksFromTopic 
} = require('./puppeteerResolver_enhanced');

const fetch = require('node-fetch');

/**
 * 解码单个Google News URL（增强版）
 */
async function decodeGoogleNewsUrl(encodedUrl) {
    console.log(`🔍 Enhanced decode: ${encodedUrl.substring(0, 80)}...`);
    
    // 策略1：静态解码
    const staticResult = decodeGoogleNewsUrlStatic(encodedUrl);
    if (staticResult) {
        return staticResult;
    }
    
    // 策略2：网络重定向
    const redirectResult = await fetchRedirectUrl(encodedUrl);
    if (redirectResult) {
        return redirectResult;
    }
    
    console.log(`❌ All decode strategies failed`);
    return null;
}

/**
 * 解码多个Google News URLs - 增强版混合方案
 * @param {string[]} urls An array of encoded Google News URLs.
 * @param {Object} options Options including RSS metadata for fallback
 * @returns {Promise<string[]>} A promise that resolves to an array of decoded URLs.
 */
async function resolveGoogleNewsUrls(urls, options = {}) {
    if (!urls || urls.length === 0) {
        return [];
    }

    console.log(`   Enhanced decoding ${urls.length} Google News links...`);
    const resolvedLinks = new Set();
    let staticSuccessCount = 0;
    let redirectSuccessCount = 0;
    let fallbackCount = 0;

    for (const url of urls) {
        if (url.includes('/stories/')) {
            process.stdout.write(`    - Skipping story collection: ${url.slice(0, 80)}...\n`);
            continue;
        }
        
        process.stdout.write(`    - Processing: ${url.slice(0, 80)}... `);
        
        // 策略1：静态解码
        const staticResult = decodeGoogleNewsUrlStatic(url);
        if (staticResult) {
            process.stdout.write(`[Static] ✅\n`);
            resolvedLinks.add(staticResult);
            staticSuccessCount++;
            continue;
        }
        
        // 策略2：网络重定向
        const redirectResult = await fetchRedirectUrl(url);
        if (redirectResult && redirectResult !== url) {
            process.stdout.write(`[Redirect] ✅\n`);
            resolvedLinks.add(redirectResult);
            redirectSuccessCount++;
            continue;
        }
        
        // 策略3：长URL作为元数据使用
        const isLongUrl = url.length > 150;
        if (isLongUrl) {
            process.stdout.write(`[Metadata] 📋\n`);
            resolvedLinks.add(url);
            fallbackCount++;
        } else {
            process.stdout.write(`[Failed] ❌\n`);
        }
    }
    
    console.log(`   Enhanced processing completed:`);
    console.log(`     Static decode: ${staticSuccessCount}, Redirect: ${redirectSuccessCount}, Fallback: ${fallbackCount}`);
    console.log(`     Total coverage: ${Math.round(((staticSuccessCount + redirectSuccessCount + fallbackCount) / urls.length) * 100)}%`);
    
    return Array.from(resolvedLinks);
}

/**
 * Debug function - 增强版调试
 */
async function debugDecodeUrl(encodedUrl) {
    console.log(`=== Enhanced Debug Decoding ===`);
    console.log(`Input: ${encodedUrl}`);
    
    const result = await decodeGoogleNewsUrl(encodedUrl);
    console.log(`Result: ${result || 'Failed'}`);
    
    return result;
}

/**
 * 从Google News Topic获取原始链接 - 新增功能
 */
async function getNewsLinksFromTopic(topicUrl, options = {}) {
    console.log(`🚀 Enhanced topic link extraction: ${topicUrl}`);
    return await getOriginalNewsLinksFromTopic(topicUrl, options);
}

module.exports = { 
    resolveGoogleNewsUrls, 
    debugDecodeUrl,
    getNewsLinksFromTopic,
    decodeGoogleNewsUrl
};
