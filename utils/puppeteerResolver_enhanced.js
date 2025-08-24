/**
 * Google News URL Resolver - 简化版
 * 只保留重定向 + Puppeteer的核心功能
 */

const fetch = require('node-fetch');
const xml2js = require('xml2js');

/**
 * 网络重定向获取真实新闻URL
 */
async function fetchRedirectUrl(url) {
    try {
        const response = await fetch(url, { 
            method: 'HEAD', 
            redirect: 'follow',
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; NewsScraperBot/1.0)'
            }
        });
        
        if (response.url !== url) {
            return response.url;
        } else {
            return null;
        }
    } catch (e) {
        return null;
    }
}

/**
 * RSS方式获取链接（来自groksearchandparse.js）
 */

/**
 * RSS方式获取链接（来自groksearchandparse.js）
 */
async function fetchUrlsFromRSS(topicUrl) {
    try {
        console.log(`📡 RSS fetch: ${topicUrl.substring(0, 80)}...`);
        
        // 生成RSS URL
        let rssUrl = topicUrl;
        if (!rssUrl.includes('/rss/')) {
            if (rssUrl.includes('/topics/')) {
                rssUrl = rssUrl.replace('/topics/', '/rss/topics/');
            } else if (rssUrl.includes('/search?')) {
                rssUrl = rssUrl.replace('/search?', '/rss/search?');
            } else {
                rssUrl = rssUrl.replace('news.google.com/', 'news.google.com/rss/');
            }
        }
        
        const response = await fetch(rssUrl, { 
            method: 'GET',
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; NewsScraperBot/1.0)'
            }
        });
        
        if (!response.ok) {
            throw new Error(`RSS请求失败: ${response.statusText}`);
        }
        
        const xmlText = await response.text();
        const parser = new xml2js.Parser();
        const rssData = await parser.parseStringPromise(xmlText);
        
        const items = rssData.rss.channel[0].item || [];
        const encodedUrls = items.map(item => item.link[0]);
        
        console.log(`✅ RSS success: found ${encodedUrls.length} encoded URLs`);
        return encodedUrls;
        
    } catch (error) {
        console.log(`❌ RSS failed: ${error.message}`);
        return [];
    }
}

/**
 * 主解析函数 - 增强版：重定向+Puppeteer组合
 */
async function resolveGoogleNewsUrls(urls, options = {}) {
    if (!urls || urls.length === 0) {
        return [];
    }

    console.log(`🔗 Processing ${urls.length} Google News URLs...`);
    const resolvedLinks = new Set();
    let successCount = 0;
    let errorCount = 0;

    for (const [index, url] of urls.entries()) {
        if (url.includes('/stories/')) {
            console.log(`   - Skipping story collection: ${url.slice(0, 80)}...`);
            continue;
        }
        
        const itemNumber = index + 1;
        console.log(`   - Processing ${itemNumber}/${urls.length}: ${url.substring(0, 70)}...`);
        
        try {
            // 首先尝试重定向获取真实新闻URL
            const realUrl = await fetchRedirectUrl(url);
            
            if (realUrl && realUrl !== url) {
                console.log(`✅ Redirect success: ${realUrl.substring(0, 80)}...`);
                resolvedLinks.add(realUrl);
                console.log(`   [${itemNumber}] ✅ Success via redirect`);
                successCount++;
            } else {
                // 重定向失败，使用Puppeteer
                console.log(`🎭 Fallback to Puppeteer: ${url.substring(0, 80)}...`);
                const puppeteerResults = await fetchUrlWithPuppeteer(url, options);
                
                if (puppeteerResults.length > 0) {
                    puppeteerResults.forEach(link => resolvedLinks.add(link));
                    console.log(`   [${itemNumber}] ✅ Success via Puppeteer (${puppeteerResults.length} URL)`);
                    successCount++;
                } else {
                    console.log(`   [${itemNumber}] ❌ Both redirect and Puppeteer failed`);
                    errorCount++;
                }
            }
            
            // 批次间暂停，避免请求过于频繁
            if (index < urls.length - 1) {
                console.log(`   💤 批次间暂停 2 秒...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
        } catch (error) {
            console.log('💥 Processing error:', error.message);
            console.log(`   [${itemNumber}] ❌ Error`);
            errorCount++;
        }
    }

    const finalResults = Array.from(resolvedLinks);
    console.log(`\n🎯 处理完成! 统计结果:`);
    console.log(`   - 成功: ${successCount}`);
    console.log(`   - 错误: ${errorCount}`);
    console.log(`   - 总链接数: ${finalResults.length}`);
    
    return finalResults;
}

/**
 * Puppeteer动态获取Google News链接的最终新闻源URL
 */
async function fetchUrlWithPuppeteer(googleNewsUrl, options = {}) {
    let browser = null;
    try {
        console.log(`🎭 Puppeteer解析: ${googleNewsUrl.substring(0, 80)}...`);
        
        // 动态导入puppeteer
        const puppeteer = require('puppeteer');
        
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-blink-features=AutomationControlled'
            ]
        });
        
        const page = await browser.newPage();
        
        // 设置用户代理和视口
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 720 });
        
        // 设置超时时间
        const timeout = options.timeout || 30000;
        
        // 访问Google News URL，让它自动跳转到最终的新闻源
        await page.goto(googleNewsUrl, { 
            waitUntil: 'networkidle2',
            timeout: timeout 
        });
        
        // 等待页面完全加载和可能的重定向
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 获取最终的URL（经过所有重定向后的新闻源URL）
        const finalUrl = page.url();
        
        // 验证这是一个有效的新闻源URL（不是Google相关域名）
        if (finalUrl && 
            finalUrl !== googleNewsUrl &&
            !finalUrl.includes('google.com') &&
            !finalUrl.includes('googlenews.com') &&
            !finalUrl.includes('googleusercontent.com')) {
            
            console.log(`   ✅ 成功获取新闻源URL: ${finalUrl.substring(0, 100)}...`);
            return [finalUrl]; // 返回单个新闻源URL
        } else {
            console.log(`   ⚠️ 未能获取有效的新闻源URL，当前URL: ${finalUrl}`);
            return [];
        }
        
    } catch (error) {
        console.log(`   ❌ Puppeteer解析失败: ${error.message}`);
        return [];
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * 从Google News Topic获取原始新闻链接的完整解决方案
 */
async function getOriginalNewsLinksFromTopic(topicUrl, options = {}) {
    console.log(`🚀 Starting enhanced news link extraction from: ${topicUrl}`);
    
    try {
        // 策略1：尝试RSS方式获取编码链接
        console.log(`\n📡 Step 1: RSS extraction...`);
        const encodedUrls = await fetchUrlsFromRSS(topicUrl);
        
        if (encodedUrls.length > 0) {
            console.log(`\n🔄 Step 2: Decoding ${encodedUrls.length} URLs...`);
            const decodedUrls = await resolveGoogleNewsUrls(encodedUrls, options);
            
            if (decodedUrls.length > 0) {
                console.log(`✅ Success via RSS + decoding: ${decodedUrls.length} URLs`);
                return decodedUrls;
            }
        }
        
        // 策略2：如果RSS失败，尝试Puppeteer
        if (options.enablePuppeteer !== false) {
            console.log(`\n🎭 Step 3: Puppeteer extraction (fallback)...`);
            const puppeteerUrls = await fetchUrlWithPuppeteer(topicUrl);
            
            if (puppeteerUrls.length > 0) {
                console.log(`✅ Success via Puppeteer: ${puppeteerUrls.length} URLs`);
                return puppeteerUrls;
            }
        }
        
        console.log(`❌ All strategies failed`);
        return [];
        
    } catch (error) {
        console.error(`❌ Enhanced extraction failed: ${error.message}`);
        return [];
    }
}

module.exports = { 
    resolveGoogleNewsUrls,
    getOriginalNewsLinksFromTopic,
    fetchRedirectUrl,
    fetchUrlsFromRSS,
    fetchUrlWithPuppeteer
};
