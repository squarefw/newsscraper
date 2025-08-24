const fetch = require('node-fetch');
const xml2js = require('xml2js');

// Google News 链接前缀
const ENCODED_URL_PREFIX = "https://news.google.com/rss/articles/";
const ENCODED_URL_RE = new RegExp(`^${ENCODED_URL_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(.+?)(\\?|$)`, 'i');
// 更灵活的正则，匹配任何 http(s) URL
const DECODED_URL_RE = /https?:\/\/[^ \t\n\r\0\x08\x13\x1a\x1b]+/g;

async function fetchRedirectUrl(url) {
    /**
     * Fallback: Follow redirect to get original URL.
     */
    try {
        const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
        return response.url;
    } catch (e) {
        console.warn(`跟随重定向失败: ${url} - ${e.message}`);
        return null;
    }
}

function decodeGoogleNewsUrl(url) {
    if (!url.startsWith(ENCODED_URL_PREFIX)) {
        throw new Error("无效的 Google News 链接格式。");
    }

    const match = url.match(ENCODED_URL_RE);
    if (!match) {
        throw new Error("无法提取编码部分。");
    }

    let encodedText = match[1];
    encodedText = encodedText.replace(/[^A-Za-z0-9\-_]/g, '');
    encodedText = encodedText.replace(/-/g, '+').replace(/_/g, '/');

    const paddingLength = (4 - (encodedText.length % 4)) % 4;
    encodedText += '='.repeat(paddingLength);

    let decodedText;
    try {
        const binaryBuffer = Buffer.from(encodedText, 'base64');
        decodedText = binaryBuffer.toString('latin1');
    } catch (e) {
        throw new Error(`Base64 解码失败: ${e.message}`);
    }

    const decodedMatches = decodedText.match(DECODED_URL_RE);
    if (!decodedMatches || decodedMatches.length === 0) {
        console.warn(`无法匹配 URL，原始解码数据: ${JSON.stringify(decodedText)}`);
        throw new Error("无法从解码数据中提取 URL。");
    }

    // Return the first valid URL (prefer non-AMP if possible)
    return decodedMatches.find(url => !url.includes('google.com/amp/')) || decodedMatches[0];
}

async function getOriginalNewsLinksFromGoogleNews(url, retry = true) {
    /**
     * 从 Google News 搜索/话题 URL 获取新闻列表，并解析原始链接。
     * 
     * @param {string} url - Google News 话题或搜索 URL
     * @param {boolean} retry - 是否尝试备用 RSS 格式
     * @returns {Promise<Array<string>>} 原始新闻链接列表
     * @throws {Error} 如果处理失败
     */
    // 生成 RSS URL
    let rssUrl = url;
    if (!rssUrl.includes('/rss/')) {
        if (rssUrl.includes('/topics/')) {
            rssUrl = rssUrl.replace('/topics/', '/rss/topics/');
        } else if (rssUrl.includes('/search?')) {
            rssUrl = rssUrl.replace('/search?', '/rss/search?');
        } else {
            rssUrl = rssUrl.replace('news.google.com/', 'news.google.com/rss/');
        }
    }

    console.log(`生成的 RSS URL: ${rssUrl}`);

    let response;
    try {
        response = await fetch(rssUrl, { method: 'GET' });
        if (!response.ok) {
            if (retry && response.status === 404) {
                // Retry with alternative format (remove extra params)
                const baseRssUrl = rssUrl.split('?')[0];
                console.log(`重试 RSS URL: ${baseRssUrl}`);
                return getOriginalNewsLinksFromGoogleNews(baseRssUrl, false);
            }
            throw new Error(`获取 RSS 失败: ${response.statusText}`);
        }
    } catch (e) {
        throw new Error(`网络请求失败: ${e.message}`);
    }

    const xmlText = await response.text();
    const parser = new xml2js.Parser();
    let rssData;
    try {
        rssData = await parser.parseStringPromise(xmlText);
    } catch (e) {
        throw new Error(`XML 解析失败: ${e.message}`);
    }

    const items = rssData.rss.channel[0].item || [];
    if (items.length === 0) {
        console.warn("RSS 中没有新闻项。");
        return [];
    }

    const originalUrls = [];
    for (const item of items) {
        const encodedUrl = item.link[0];
        try {
            const originalUrl = decodeGoogleNewsUrl(encodedUrl);
            originalUrls.push(originalUrl);
        } catch (e) {
            console.warn(`静态解码失败: ${encodedUrl} - ${e.message}`);
            // Fallback to network redirect
            const redirectUrl = await fetchRedirectUrl(encodedUrl);
            if (redirectUrl) {
                originalUrls.push(redirectUrl);
            }
        }
    }

    return originalUrls;
}

// 示例使用
const exampleUrl = "https://news.google.com/topics/CAAqJQgKIh9DQkFTRVFvSUwyMHZNREpqWm5QU0JXVnVMVWRDS0FBUAE?ceid=IE:en&oc=3";
const fallbackUrl = "https://news.google.com/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en";

async function run() {
    try {
        console.log("尝试 Dublin 话题...");
        let links = await getOriginalNewsLinksFromGoogleNews(exampleUrl);
        console.log("Dublin 话题原始新闻链接列表:");
        if (links.length === 0) {
            console.log("没有找到新闻链接。");
        } else {
            links.forEach((link, index) => console.log(`${index + 1}: ${link}`));
        }

        if (links.length === 0) {
            console.log("\nDublin 话题为空，尝试世界新闻话题...");
            links = await getOriginalNewsLinksFromGoogleNews(fallbackUrl);
            console.log("世界新闻话题原始新闻链接列表:");
            if (links.length === 0) {
                console.log("没有找到新闻链接。");
            } else {
                links.forEach((link, index) => console.log(`${index + 1}: ${link}`));
            }
        }
    } catch (e) {
        console.error("错误:", e.message);
    }
}

run();