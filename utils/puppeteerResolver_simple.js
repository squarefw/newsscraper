/**
 * Google News URL Resolver - 简化版
 * 只保留最有效的Puppeteer方法，删除其他经常失败的方法
 */

/**
 * Puppeteer动态抓取原始URL（优化版）
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
        
        // 访问Google News URL
        await page.goto(googleNewsUrl, { 
            waitUntil: 'networkidle2',
            timeout: timeout 
        });
        
        // 等待内容加载
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 提取真实新闻网站的链接
        const newsLinks = await page.evaluate(() => {
            const allLinks = Array.from(document.querySelectorAll('a[href]'));
            const externalLinks = allLinks
                .map(link => link.href)
                .filter(href => 
                    href && 
                    href.startsWith('http') && 
                    !href.includes('google.com') &&
                    !href.includes('googlenews.com') &&
                    !href.includes('youtube.com') &&
                    !href.includes('googleusercontent.com') &&
                    !href.includes('gstatic.com') &&
                    !href.includes('googleapis.com') &&
                    !href.includes('googletagmanager.com') &&
                    !href.includes('facebook.com') &&
                    !href.includes('twitter.com') &&
                    !href.includes('instagram.com') &&
                    !href.includes('linkedin.com') &&
                    // 过滤掉明显的非新闻链接
                    !href.includes('/privacy') &&
                    !href.includes('/terms') &&
                    !href.includes('/contact') &&
                    !href.includes('/about') &&
                    // 优先保留包含新闻相关路径的链接
                    (href.includes('/news/') || 
                     href.includes('/article') || 
                     href.includes('/story') ||
                     href.includes('/post/') ||
                     href.includes('article') ||
                     href.length > 50) // 长URL通常是新闻文章
                )
                .filter((href, index, arr) => arr.indexOf(href) === index); // 去重
            
            return externalLinks; // 返回所有相关的链接，不做数量限制
        });
        
        if (newsLinks.length > 0) {
            console.log(`   ✅ 成功获取 ${newsLinks.length} 个新闻链接`);
            newsLinks.forEach((link, index) => {
                console.log(`      ${index + 1}. ${link.substring(0, 100)}...`);
            });
            return newsLinks;
        } else {
            console.log(`   ⚠️ 未找到有效的新闻链接`);
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
 * 批量解析Google News URLs（简化版）
 */
async function resolveGoogleNewsUrls(urls, options = {}) {
    if (!urls || urls.length === 0) {
        return [];
    }

    console.log(`🔄 简化解析器: 处理 ${urls.length} 个URL...`);
    const resolvedLinks = new Set();
    let successCount = 0;
    
    // 限制并发数量以避免被封
    const concurrency = options.concurrency || 2;
    
    for (let i = 0; i < urls.length; i += concurrency) {
        const batch = urls.slice(i, i + concurrency);
        const batchPromises = batch.map(async (url) => {
            if (url.includes('/stories/')) {
                console.log(`   - 跳过故事集合: ${url.slice(0, 80)}...`);
                return [];
            }
            
            console.log(`   - 处理中: ${url.slice(0, 80)}...`);
            const results = await fetchUrlWithPuppeteer(url, options);
            if (results.length > 0) {
                successCount++;
                return results;
            }
            return [];
        });
        
        const batchResults = await Promise.all(batchPromises);
        batchResults.flat().forEach(link => resolvedLinks.add(link));
        
        // 批次间暂停，避免请求过于频繁
        if (i + concurrency < urls.length) {
            console.log(`   💤 批次间暂停 2 秒...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    console.log(`✅ 简化解析器完成:`);
    console.log(`   - 成功处理: ${successCount}/${urls.length}`);
    console.log(`   - 获得链接: ${resolvedLinks.size}`);
    console.log(`   - 成功率: ${Math.round((successCount / urls.length) * 100)}%`);
    
    return Array.from(resolvedLinks);
}

module.exports = { 
    fetchUrlWithPuppeteer,
    resolveGoogleNewsUrls
};
