// Google News 链接前缀
const ENCODED_URL_PREFIX = "https://news.google.com/rss/articles/";

// 正则表达式用于提取编码部分（从 /articles/ 后到 ? 或字符串末尾）
const ENCODED_URL_RE = new RegExp(`^${ENCODED_URL_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(.+?)(\\?|$)`, 'i');

// 正则表达式用于从解码后的二进制字符串中提取原始 URL
const DECODED_URL_RE = /^[\x08\x13"].+?(http[^\xd2]+)\xd2\x01/;

function decodeGoogleNewsUrl(url) {
    /**
     * 从 Google News 链接中提取原始网站 URL。
     * 
     * @param {string} url - Google News 的重定向链接，例如 'https://news.google.com/rss/articles/CBMi...'
     * @returns {string} 原始新闻来源的 URL。
     * @throws {Error} 如果链接无效或无法解码。
     */
    if (!url.startsWith(ENCODED_URL_PREFIX)) {
        throw new Error("无效的 Google News 链接格式。");
    }

    const match = url.match(ENCODED_URL_RE);
    if (!match) {
        throw new Error("无法提取编码部分。");
    }

    let encodedText = match[1];
    // 移除可能的非法字符（如末尾的 /）
    encodedText = encodedText.replace(/[^A-Za-z0-9\-_]/g, '');
    // 转换为标准 base64（替换 urlsafe 字符）
    encodedText = encodedText.replace(/-/g, '+').replace(/_/g, '/');

    // 动态计算 padding
    const paddingLength = (4 - (encodedText.length % 4)) % 4;
    encodedText += '='.repeat(paddingLength);

    let decodedText;
    try {
        // 使用 Buffer 在 Node.js 中更可靠，或使用 atob 在浏览器中
        if (typeof Buffer !== 'undefined') {
            decodedText = Buffer.from(encodedText, 'base64').toString('binary');
        } else {
            decodedText = atob(encodedText);
        }
    } catch (e) {
        throw new Error(`Base64 解码失败: ${e.message}`);
    }

    const decodedMatch = decodedText.match(DECODED_URL_RE);
    if (!decodedMatch) {
        throw new Error("无法从解码数据中提取 URL。");
    }

    const primaryUrl = decodedMatch[1];
    return primaryUrl;
}

// 示例使用
const exampleUrl = "https://news.google.com/rss/articles/CBMiSGh0dHBzOi8vdGVjaGNydW5jaC5jb20vMjAyMi8xMC8yNy9uZXcteW9yay1wb3N0LWhhY2tlZC1vZmZlbnNpdmUtdHdlZXRzL9IBAA?oc=5";
try {
    const originalUrl = decodeGoogleNewsUrl(exampleUrl);
    console.log("原始 URL:", originalUrl);
    // 预期输出: https://techcrunch.com/2022/10/27/new-york-post-hacked-offensive-tweets/
} catch (e) {
    console.error("错误:", e.message);
}