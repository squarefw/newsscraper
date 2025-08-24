#!/usr/bin/env node

/**
 * 提取Google News JavaScript重定向URL
 */

const fetch = require('node-fetch');

async function extractRedirectUrl(url) {
    console.log('🔍 Extracting redirect URL from Google News');
    console.log('URL:', url.substring(0, 100) + '...');
    console.log('');
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        const html = await response.text();
        
        // 搜索各种重定向模式
        const patterns = [
            // window.location
            /window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/g,
            /window\.location\.replace\s*\(\s*["']([^"']+)["']\s*\)/g,
            
            // location.href
            /location\.href\s*=\s*["']([^"']+)["']/g,
            /location\.replace\s*\(\s*["']([^"']+)["']\s*\)/g,
            
            // Meta refresh
            /<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^"']*url=([^"']+)["']/gi,
            
            // Data attributes或其他模式
            /data-url=["']([^"']+)["']/g,
            /href=["'](https?:\/\/[^"']*news[^"']*)["']/g
        ];
        
        console.log('🔍 Searching for redirect patterns...');
        
        let foundUrls = new Set();
        
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(html)) !== null) {
                const foundUrl = match[1];
                if (foundUrl && foundUrl.startsWith('http') && !foundUrl.includes('google.com')) {
                    foundUrls.add(foundUrl);
                    console.log(`✅ Found URL: ${foundUrl}`);
                }
            }
        }
        
        if (foundUrls.size === 0) {
            console.log('🔍 No direct URLs found, searching for encoded patterns...');
            
            // 搜索可能的编码URL
            const encodedPatterns = [
                /["'](https?:\/\/[^"']+)["']/g,
                /url=([^&\s"']+)/g
            ];
            
            for (const pattern of encodedPatterns) {
                let match;
                while ((match = pattern.exec(html)) !== null) {
                    const candidate = match[1];
                    try {
                        const decoded = decodeURIComponent(candidate);
                        if (decoded.startsWith('http') && !decoded.includes('google.com')) {
                            foundUrls.add(decoded);
                            console.log(`✅ Found decoded URL: ${decoded}`);
                        }
                    } catch (e) {
                        // 忽略解码错误
                    }
                }
            }
        }
        
        if (foundUrls.size === 0) {
            console.log('📄 No URLs found. Saving HTML for manual inspection...');
            require('fs').writeFileSync('debug_google_news.html', html);
            console.log('💾 HTML saved to debug_google_news.html');
            
            // 搜索关键部分
            const scriptSections = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
            console.log(`🔍 Found ${scriptSections.length} script sections`);
            
            for (let i = 0; i < Math.min(scriptSections.length, 3); i++) {
                const script = scriptSections[i];
                if (script.includes('location') || script.includes('redirect') || script.includes('href')) {
                    console.log(`\nScript ${i + 1} (relevant part):`);
                    console.log(script.substring(0, 500) + '...');
                }
            }
        } else {
            console.log(`\n✅ Total found: ${foundUrls.size} unique URLs`);
            Array.from(foundUrls).forEach((url, index) => {
                console.log(`${index + 1}. ${url}`);
            });
        }
        
        return Array.from(foundUrls);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        return [];
    }
}

// 测试URL
const testUrl = 'https://news.google.com/rss/articles/CBMi5AJBVV95cUxQdzVScUtJYTg3Y2NaOGxjZm1YUFNLWTh3aFdFZHdETklGRlVEcHF6Y3RJTzk2VE55TmF3YjlIQURSYkRWQnh3Q3lIX2cyRldzODdNV2xFRXhWbmpaYnNhTWYtTFh5SGxhU3AxLUhuUElfX2wzUWdMU3BVYThvMmFaak9KanZnOG5tb25qeU03TklwMUZhNlVaR0VhMFU5ZlFIcUhLR2lSbHdSdmNhWDFMbEhndnhuSjdQNjFhRzAtVmhZMzlUTEZSQm9VRXh2SmE4c0p2VWFCclh4S3liblNsOWphc29XRWJKLVJVUUItVGh3UmRrLU1KTk5DdUlVT3BQOFktUk5JYXc4aXJaeXpydi0xODJza241U3V3YmJJWmVUdEsyUXU4ZlhMX2tJdXl0SUZZRURqY3QwT1hNMTNKZklBbEtnTk5xbFhRNGVNczhRb1BMMzdIa19VTVMwbWRubTYwbw?oc=5&ucbcb=1&hl=en-IE&gl=IE&ceid=IE:en';

extractRedirectUrl(testUrl).catch(console.error);
