#!/usr/bin/env node

/**
 * 测试深度重定向解析器
 */

const { fetchFinalRedirectUrl, resolveGoogleNewsUrls } = require('./utils/puppeteerResolver_enhanced');

async function testDeepRedirect() {
    console.log('🧪 Testing Deep Redirect Resolver');
    console.log('=====================================\n');
    
    // 测试单个URL的深度重定向
    const testUrl = 'https://news.google.com/rss/articles/CBMi5AJBVV95cUxQdzVScUtJYTg3Y2NaOGxjZm1YUFNLWTh3aFdFZHdETklGRlVEcHF6Y3RJTzk2VE55TmF3YjlIQURSYkRWQnh3Q3lIX2cyRldzODdNV2xFRXhWbmpaYnNhTWYtTFh5SGxhU3AxLUhuUElfX2wzUWdMU3BVYThvMmFaak9KanZnOG5tb25qeU03TklwMUZhNlVaR0VhMFU5ZlFIcUhLR2lSbHdSdmNhWDFMbEhndnhuSjdQNjFhRzAtVmhZMzlUTEZSQm9VRXh2SmE4c0p2VWFCclh4S3liblNsOWphc29XRWJKLVJVUUItVGh3UmRrLU1KTk5DdUlVT3BQOFktUk5JYXc4aXJaeXpydi0xODJza241U3V3YmJJWmVUdEsyUXU4ZlhMX2tJdXl0SUZZRURqY3QwT1hNMTNKZklBbEtnTk5xbFhRNGVNczhRb1BMMzdIa19VTVMwbWRubTYwbw?oc=5&ucbcb=1&hl=en-IE&gl=IE&ceid=IE:en';
    
    console.log('🔍 Test 1: Single URL Deep Redirect');
    console.log('URL:', testUrl.substring(0, 100) + '...');
    console.log('');
    
    const finalUrl = await fetchFinalRedirectUrl(testUrl);
    if (finalUrl) {
        console.log('✅ Success! Final URL:', finalUrl);
        
        // 分析域名
        try {
            const urlObj = new URL(finalUrl);
            console.log('🌐 Domain:', urlObj.hostname);
            console.log('📰 News Source:', extractNewsSource(urlObj.hostname));
        } catch (e) {
            console.log('⚠️ Could not parse final URL');
        }
    } else {
        console.log('❌ Failed to get final URL');
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // 测试批量解析
    console.log('🔍 Test 2: Batch URL Resolution');
    const testUrls = [
        'https://news.google.com/rss/articles/CBMi5AJBVV95cUxQdzVScUtJYTg3Y2NaOGxjZm1YUFNLWTh3aFdFZHdETklGRlVEcHF6Y3RJTzk2VE55TmF3YjlIQURSYkRWQnh3Q3lIX2cyRldzODdNV2xFRXhWbmpaYnNhTWYtTFh5SGxhU3AxLUhuUElfX2wzUWdMU3BVYThvMmFaak9KanZnOG5tb25qeU03TklwMUZhNlVaR0VhMFU5ZlFIcUhLR2lSbHdSdmNhWDFMbEhndnhuSjdQNjFhRzAtVmhZMzlUTEZSQm9VRXh2SmE4c0p2VWFCclh4S3liblNsOWphc29XRWJKLVJVUUItVGh3UmRrLU1KTk5DdUlVT3BQOFktUk5JYXc4aXJaeXpydi0xODJza241U3V3YmJJWmVUdEsyUXU4ZlhMX2tJdXl0SUZZRURqY3QwT1hNMTNKZklBbEtnTk5xbFhRNGVNczhRb1BMMzdIa19VTVMwbWRubTYwbw?oc=5&ucbcb=1&hl=en-IE&gl=IE&ceid=IE:en',
        'https://news.google.com/rss/articles/CBMi4AJBVV95cUxNdlRKYVVWZ2RLYmR6c1RoMWFRVUdRQkJtcXFjMUZadkI2c2FJa1RaY0R2UVFxUmYzeGNpMmdmaXlPcjRWOG9Id21JUEpEaG8tM21ZWWlCVXZhU29NWG83RE1oTkxwaVFJcVRuLWlIZThvZ1M1RkhuN2lxM3F6UGpzWmcza3BqSm1BQ1k5TWJjQXk4OEMzR3Vfb29qT1ZSbEZ4TllqLUlrd00yaVpWMlJqUWEwMmRpOVVya1hFSTQwOEhNRC1rVkxsYmwzUVZyNDJNYUF1dlBteWdYMEJHWDJXZ0hKcy05Zmc3Nmt5R05sTlE4Yi1NTkdGMWRtOHZrTlBfcldibUlIZ3VGRnMxUVZoUjd0aVBNVjVHLXlBVXNlSnVLa3B5d0NjRjZhUWR5WGVWd0M4WTFtU0xDRER2eUh1bmE0a1JvLTZSeFZVWlZFQU1VLThLODgyZjZaUWwzS3NT?oc=5&ucbcb=1&hl=en-IE&gl=IE&ceid=IE:en',
        'https://news.google.com/rss/articles/CBMigwJBVV95cUxObHNmNU9ZSXhERDdsLWdURlBXejVtV2hhWWlnY2VrQ1RKa1pmZDM4OU1zZmVxamNoSkJ0Y0xnMEVEZV9DemxTVkhmdjlXLXUyY2NSU3Z0NzduVl8xRWJVd2VwNXd1MFVjVnhkcDZBb28wa0ZVbUVYSDN5QnNuWFN4Mm4tX190RkM4Rzl1Z25ZQlVTLWdaZDh1czdla2picEhpSFUwMHExTkZrMERJOXZlNEFKWUswZ0pPQlh2VS1ZTmJRT2VtRVgwc3R1cUl3aHZVZ2tNUC1nTUNBWWdONUMyMGNqWGdpcnNiSlZPazdobFptVFRpN2YzRDlWa1ZNLXFlaE44?oc=5&ucbcb=1&hl=en-IE&gl=IE&ceid=IE:en'
    ];
    
    console.log(`Processing ${testUrls.length} test URLs...\n`);
    
    const resolvedUrls = await resolveGoogleNewsUrls(testUrls);
    
    console.log('\n📊 Results Summary:');
    console.log(`✅ Successfully resolved: ${resolvedUrls.length}/${testUrls.length} URLs`);
    console.log('');
    
    resolvedUrls.forEach((url, index) => {
        try {
            const urlObj = new URL(url);
            console.log(`${index + 1}. ${urlObj.hostname} - ${url.substring(0, 80)}...`);
        } catch (e) {
            console.log(`${index + 1}. Invalid URL - ${url.substring(0, 80)}...`);
        }
    });
}

function extractNewsSource(hostname) {
    const sourceMap = {
        'rte.ie': 'RTÉ Ireland',
        'thejournal.ie': 'TheJournal.ie',
        'irishtimes.com': 'Irish Times',
        'independent.ie': 'Irish Independent',
        'bbc.com': 'BBC',
        'bbc.co.uk': 'BBC',
        'cnn.com': 'CNN',
        'reuters.com': 'Reuters',
        'theguardian.com': 'The Guardian',
        'guardian.co.uk': 'The Guardian'
    };
    
    return sourceMap[hostname] || hostname;
}

// 运行测试
if (require.main === module) {
    testDeepRedirect().catch(console.error);
}
