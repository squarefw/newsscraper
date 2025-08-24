const axios = require('axios');
const cheerio = require('cheerio');

/**
 * 从URL提取新闻内容（标题和正文）
 * @param {string} url - 文章URL
 * @returns {Promise<{title: string, content: string}>}
 */
async function extractNewsFromUrl(url) {
    try {
        console.log(`   📡 正在访问: ${url}`);
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 15000
        });

        const $ = cheerio.load(data);

        // 提取标题
        const title = $('h1').first().text().trim() || $('title').text().trim();

        // 提取正文 (这是一个通用的尝试，可能需要为特定网站优化)
        let content = '';
        $('article p, .article-body p, .story-body p').each((i, elem) => {
            content += $(elem).text().trim() + '\n';
        });

        if (!content) {
            $('p').each((i, elem) => {
                content += $(elem).text().trim() + '\n';
            });
        }
        
        console.log(`   ✅ 提取成功 - 标题: ${title.length}字符, 正文: ${content.length}字符`);
        return { title, content: content.slice(0, 8000) }; // 限制内容长度

    } catch (error) {
        console.error(`   ❌ 提取内容失败 ${url}:`, error.message);
        return { title: '', content: '' };
    }
}

module.exports = { extractNewsFromUrl };
