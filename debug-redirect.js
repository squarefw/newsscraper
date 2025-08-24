#!/usr/bin/env node

/**
 * 调试Google News重定向
 */

const fetch = require('node-fetch');

async function debugGoogleRedirect(url) {
    console.log('🔍 Debug Google News Redirect');
    console.log('URL:', url);
    console.log('');
    
    try {
        console.log('📡 Testing GET request...');
        const response = await fetch(url, {
            method: 'GET',
            redirect: 'manual',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        console.log('Status:', response.status);
        console.log('Status Text:', response.statusText);
        console.log('Headers:');
        for (const [key, value] of response.headers.entries()) {
            console.log(`  ${key}: ${value}`);
        }
        
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            console.log('\n✅ Redirect detected!');
            console.log('Location:', location);
        } else if (response.status === 200) {
            console.log('\n📄 Got 200 response, checking content...');
            const text = await response.text();
            console.log('Content length:', text.length);
            console.log('First 500 chars:');
            console.log(text.substring(0, 500));
            
            // 查找重定向模式
            const metaRefresh = text.match(/<meta[^>]+http-equiv=["']refresh["'][^>]*>/i);
            const jsRedirect = text.match(/window\.location|location\.href|location\.replace/i);
            
            if (metaRefresh) {
                console.log('\n🔍 Found meta refresh:', metaRefresh[0]);
            }
            if (jsRedirect) {
                console.log('\n🔍 Found JS redirect pattern');
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// 测试URL
const testUrl = 'https://news.google.com/rss/articles/CBMi5AJBVV95cUxQdzVScUtJYTg3Y2NaOGxjZm1YUFNLWTh3aFdFZHdETklGRlVEcHF6Y3RJTzk2VE55TmF3YjlIQURSYkRWQnh3Q3lIX2cyRldzODdNV2xFRXhWbmpaYnNhTWYtTFh5SGxhU3AxLUhuUElfX2wzUWdMU3BVYThvMmFaak9KanZnOG5tb25qeU03TklwMUZhNlVaR0VhMFU5ZlFIcUhLR2lSbHdSdmNhWDFMbEhndnhuSjdQNjFhRzAtVmhZMzlUTEZSQm9VRXh2SmE4c0p2VWFCclh4S3liblNsOWphc29XRWJKLVJVUUItVGh3UmRrLU1KTk5DdUlVT3BQOFktUk5JYXc4aXJaeXpydi0xODJza241U3V3YmJJWmVUdEsyUXU4ZlhMX2tJdXl0SUZZRURqY3QwT1hNMTNKZklBbEtnTk5xbFhRNGVNczhRb1BMMzdIa19VTVMwbWRubTYwbw?oc=5&ucbcb=1&hl=en-IE&gl=IE&ceid=IE:en';

debugGoogleRedirect(testUrl).catch(console.error);
