/**
 * Google News URL Resolver - 简化版
 * 只保留重定向 + Puppeteer的核心功能
 */

const fetch = require('node-fetch');
const xml2js = require('xml2js');

/**
 * 网络重定向获取真实新闻URL
 */
async function fetchRedirectUrl(url, maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // 对于RSS链接，使用GET方法比HEAD更可靠，因为服务器可能对HEAD请求有不同处理
            const response = await fetch(url, {
                method: 'GET', 
                redirect: 'follow',
                follow: 10, // 允许最多10次重定向
                timeout: 15000, // 增加超时时间
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            
            // 检查最终URL是否有效且不是原始URL
            if (response.url && response.url !== url && !response.url.includes('google.com')) {
                return response.url;
            } else {
                // 如果最终URL还是google.com，说明重定向未完成，返回null
                return null;
            }
        } catch (e) {
            console.log(`   - Redirect attempt ${attempt} failed: ${e.message}`);
            if (attempt === maxRetries) {
                return null;
            }
            await new Promise(resolve => setTimeout(resolve, 2000)); // 重试前等待
        }
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
        const articleItems = items.map(item => ({
            url: item.link[0],
            title: item.title[0],
            pubDate: item.pubDate ? new Date(item.pubDate[0]) : null,
            source: item.source ? item.source[0]._ || item.source[0] : null
        }));
        
        console.log(`✅ RSS success: found ${articleItems.length} encoded URLs with timestamps`);
        return articleItems;
        
    } catch (error) {
        console.log(`❌ RSS failed: ${error.message}`);
        return [];
    }
}

/**
 * 主解析函数 - 增强版：重定向+Puppeteer组合（保持索引）
 */
async function resolveGoogleNewsUrlsWithIndex(urls, options = {}) {
    if (!urls || urls.length === 0) {
        return [];
    }

    console.log(`🔗 Processing ${urls.length} Google News URLs...`);
    const resolvedResults = [];
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
                resolvedResults.push({ url: realUrl, index: index });
                console.log(`   [${itemNumber}] ✅ Success via redirect`);
                successCount++;
            } else {
                // 如果是RSS链接，重定向失败后，使用专门的Puppeteer流程
                if (url.includes('/rss/articles/')) {
                    console.log(`🎭 Redirect failed, using Puppeteer for RSS link: ${url.substring(0, 80)}...`);
                    const finalUrl = await fetchUrlWithPuppeteer(url, { timeout: 30000, isRssLink: true });
                    if (finalUrl.length > 0) {
                        resolvedResults.push({ url: finalUrl[0], index: index });
                        console.log(`   [${itemNumber}] ✅ Success via Puppeteer (RSS)`);
                        successCount++;
                    }
                } else {
                    // 对于非RSS链接（例如直接从网页抓取的），仍然可以尝试Puppeteer作为后备
                    console.log(`🎭 Fallback to Puppeteer: ${url.substring(0, 80)}...`);
                    const puppeteerUrls = await fetchUrlWithPuppeteer(url, { timeout: 20000 });
                    if (puppeteerUrls.length > 0) {
                        resolvedResults.push({ url: puppeteerUrls[0], index: index });
                        console.log(`   [${itemNumber}] ✅ Success via Puppeteer`);
                        successCount++;
                    } // 如果Puppeteer也失败，fetchUrlWithPuppeteer内部会打印错误，这里不再重复打印
                }
            }
            
            // 添加延迟避免过度请求
            if (itemNumber % 10 === 0) {
                console.log(`   💤 批次间暂停 2 秒...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
        } catch (error) {
            console.log(`   [${itemNumber}] ❌ Error: ${error.message}`);
            errorCount++;
        }
    }

    console.log(`\n🎯 处理完成! 统计结果:`);
    console.log(`   - 成功: ${successCount}`);
    console.log(`   - 错误: ${errorCount}`);
    console.log(`   - 总链接数: ${resolvedResults.length}`);
    
    return resolvedResults;
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
                // 如果是RSS链接，重定向失败后，使用专门的Puppeteer流程
                if (url.includes('/rss/articles/')) {
                    console.log(`🎭 Redirect failed, using Puppeteer for RSS link: ${url.substring(0, 80)}...`);
                    const finalUrl = await fetchUrlWithPuppeteer(url, { timeout: 30000, isRssLink: true });
                    if (finalUrl.length > 0) {
                        finalUrl.forEach(link => resolvedLinks.add(link));
                        console.log(`   [${itemNumber}] ✅ Success via Puppeteer (RSS)`);
                        successCount++;
                    }
                } else {
                    // 对于非RSS链接（例如直接从网页抓取的），仍然可以尝试Puppeteer作为后备
                    console.log(`🎭 Fallback to Puppeteer: ${url.substring(0, 80)}...`);
                    const puppeteerResults = await fetchUrlWithPuppeteer(url, options);
                    if (puppeteerResults.length > 0) {
                        puppeteerResults.forEach(link => resolvedLinks.add(link));
                        console.log(`   [${itemNumber}] ✅ Success via Puppeteer`);
                        successCount++;
                    } // 如果Puppeteer也失败，fetchUrlWithPuppeteer内部会打印错误，这里不再重复打印
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

        // 使用 puppeteer-extra 和 stealth 插件来增强反检测能力
        const puppeteer = require('puppeteer-extra');
        const StealthPlugin = require('puppeteer-extra-plugin-stealth');
        puppeteer.use(StealthPlugin());

        // 启动浏览器
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-gpu',
                '--disable-features=VizDisplayCompositor',
                '--disable-blink-features=AutomationControlled',
                // 在某些环境中，指定语言可以帮助跳过语言选择页面
                '--lang=en-US,en'
            ]
        });
        
        const page = await browser.newPage();

        // 设置额外的HTTP头信息，使其看起来更像真实浏览器
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
        });

        // 设置用户代理和视口
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 720 });
        
        // 设置超时时间
        const timeout = options.timeout || 45000; // 适当增加超时时间
        page.setDefaultNavigationTimeout(timeout);
        
        // 访问Google News URL，让它自动跳转到最终的新闻源
        await page.goto(googleNewsUrl, { 
            // 对于RSS链接，等待页面加载完成即可；对于普通网页，等待DOM内容加载
            waitUntil: options.isRssLink ? 'load' : 'domcontentloaded',
            timeout: timeout 
        });

        // 仅在处理非RSS链接（即可能出现弹窗的普通网页）时，才处理Consent页面
        // 移除 isRssLink 判断，对所有 Puppeteer 访问都检查同意页面
        try {
            const consentButton = await page.waitForSelector('button[aria-label="Accept all"], button[aria-label="Reject all"]', { timeout: 7000 }); // 稍微增加超时
            console.log('   - 发现Google Consent页面，尝试点击同意按钮...');
            await consentButton.click();
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }); // 增加导航等待时间
        } catch (e) {
            console.log('   - 未发现Google Consent页面或超时，继续执行。');
        }
        
        // 获取最终的URL（经过所有重定向后的新闻源URL）
        let finalUrl = page.url();
        
        // 验证这是一个有效的新闻源URL（不是Google相关域名）
        if (finalUrl && 
            finalUrl !== googleNewsUrl &&
            !finalUrl.includes('google.com') &&
            !finalUrl.includes('googlenews.com') &&
            !finalUrl.includes('googleusercontent.com')) {
            
            // 清理URL，移除Google UTM参数
            const urlObj = new URL(finalUrl);
            const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'gaa_at', 'gaa_n', 'gaa_ts', 'gaa_sig'];
            paramsToRemove.forEach(param => urlObj.searchParams.delete(param));
            const cleanUrl = urlObj.toString();
            
            console.log(`   ✅ 成功获取新闻源URL: ${cleanUrl.substring(0, 100)}...`);
            return [cleanUrl]; // 返回清理后的URL
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
        const rssArticles = await fetchUrlsFromRSS(topicUrl);
        
        if (rssArticles.length > 0) {
            console.log(`\n🔄 Step 2: Decoding ${rssArticles.length} URLs...`);
            // 提取URL用于解码
            const encodedUrls = rssArticles.map(article => article.url);
            const decodedResults = await resolveGoogleNewsUrlsWithIndex(encodedUrls, options);
            
            if (decodedResults.length > 0) {
                console.log(`✅ Success via RSS + decoding: ${decodedResults.length} URLs`);
                
                // 根据索引匹配时间戳（保持顺序一致）
                const urlsWithTimestamps = decodedResults.map(result => {
                    const originalArticle = rssArticles[result.index];
                    return {
                        url: result.url,
                        date: originalArticle ? originalArticle.pubDate : new Date()
                    };
                });
                
                return urlsWithTimestamps;
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
