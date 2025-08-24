#!/usr/bin/env node

/**
 * 使用Puppeteer获取Google News的真实新闻链接
 */

const puppeteer = require('puppeteer');

async function getNewsLinksWithPuppeteer(url) {
    console.log('🎭 Using Puppeteer to extract news links');
    console.log('URL:', url.substring(0, 100) + '...');
    console.log('');
    
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security'
            ]
        });
        
        const page = await browser.newPage();
        
        // 设置用户代理
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        console.log('📡 Loading page...');
        await page.goto(url, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        console.log('⏳ Waiting for content to load...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 查找所有外部链接
        const links = await page.evaluate(() => {
            const allLinks = Array.from(document.querySelectorAll('a[href]'));
            const externalLinks = allLinks
                .map(link => link.href)
                .filter(href => 
                    href && 
                    href.startsWith('http') && 
                    !href.includes('google.com') &&
                    !href.includes('googlenews.com') &&
                    !href.includes('youtube.com') &&
                    !href.includes('googleusercontent.com')
                )
                .filter((href, index, arr) => arr.indexOf(href) === index); // 去重
            
            return externalLinks;
        });
        
        console.log(`✅ Found ${links.length} external links:`);
        links.forEach((link, index) => {
            try {
                const url = new URL(link);
                console.log(`${index + 1}. ${url.hostname} - ${link.substring(0, 80)}...`);
            } catch (e) {
                console.log(`${index + 1}. Invalid URL - ${link.substring(0, 80)}...`);
            }
        });
        
        // 如果没找到外部链接，尝试查找页面内容
        if (links.length === 0) {
            console.log('\n🔍 No external links found, checking page content...');
            
            const pageContent = await page.evaluate(() => {
                return {
                    title: document.title,
                    hasArticles: !!document.querySelector('article'),
                    hasNewsItems: !!document.querySelector('.xrnccd'),
                    allLinkCount: document.querySelectorAll('a[href]').length,
                    bodyText: document.body.innerText.substring(0, 500)
                };
            });
            
            console.log('Page info:', pageContent);
            
            // 尝试点击文章来获取重定向
            const articleFound = await page.evaluate(() => {
                const articles = document.querySelectorAll('article, .xrnccd, [data-article]');
                if (articles.length > 0) {
                    articles[0].click();
                    return true;
                }
                return false;
            });
            
            if (articleFound) {
                console.log('📰 Clicked article, waiting for redirect...');
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                const finalUrl = page.url();
                if (finalUrl !== url && !finalUrl.includes('google.com')) {
                    console.log(`✅ Redirected to: ${finalUrl}`);
                    return [finalUrl];
                }
            }
        }
        
        return links;
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        return [];
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// 测试URL
const testUrl = 'https://news.google.com/rss/articles/CBMi5AJBVV95cUxQdzVScUtJYTg3Y2NaOGxjZm1YUFNLWTh3aFdFZHdETklGRlVEcHF6Y3RJTzk2VE55TmF3YjlIQURSYkRWQnh3Q3lIX2cyRldzODdNV2xFRXhWbmpaYnNhTWYtTFh5SGxhU3AxLUhuUElfX2wzUWdMU3BVYThvMmFaak9KanZnOG5tb25qeU03TklwMUZhNlVaR0VhMFU5ZlFIcUhLR2lSbHdSdmNhWDFMbEhndnhuSjdQNjFhRzAtVmhZMzlUTEZSQm9VRXh2SmE4c0p2VWFCclh4S3liblNsOWphc29XRWJKLVJVUUItVGh3UmRrLU1KTk5DdUlVT3BQOFktUk5JYXc4aXJaeXpydi0xODJza241U3V3YmJJWmVUdEsyUXU4ZlhMX2tJdXl0SUZZRURqY3QwT1hNMTNKZklBbEtnTk5xbFhRNGVNczhRb1BMMzdIa19VTVMwbWRubTYwbw?oc=5&ucbcb=1&hl=en-IE&gl=IE&ceid=IE:en';

getNewsLinksWithPuppeteer(testUrl).catch(console.error);
