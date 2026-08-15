const axios = require('axios');
const cheerio = require('cheerio');

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
];

function getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

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

        // 1. 提取标题 (优先顺序: og:title -> h1 -> title)
        let title = $('meta[property="og:title"]').attr('content') || 
                    $('meta[name="twitter:title"]').attr('content') ||
                    $('h1').first().text().trim() || 
                    $('title').text().trim();

        // 2. 提取正文 (这是一个通用的尝试)
        let content = '';
        
        // 尝试特定的新闻容器
        const selectors = [
            'meta[property="og:description"]',
            'meta[name="description"]',
            'article p', 
            '.article-body p', 
            '.story-body p',
            '.main-content p',
            '.post-content p'
        ];

        // 优先尝试文章主体
        $('article p, .article-body p, .story-body p, .main-content p').each((i, elem) => {
            content += $(elem).text().trim() + '\n';
        });

        // 3. 兜底方案：如果没抓到正文，尝试 meta description
        if (content.length < 50) {
            const metaDesc = $('meta[property="og:description"]').attr('content') || 
                             $('meta[name="description"]').attr('content');
            if (metaDesc) {
                content = metaDesc + '\n' + content;
            }
        }

        // 4.1 尝试 JSON-LD (Schema.org Article)
        if (content.length < 100) {
            $('script[type="application/ld+json"]').each((i, elem) => {
                try {
                    const json = JSON.parse($(elem).html());
                    const data = Array.isArray(json) ? json[0] : json;
                    
                    // 递归查找 articleBody
                    const findContent = (obj) => {
                        if (obj.articleBody) return obj.articleBody;
                        if (obj.description && !content.includes(obj.description)) return obj.description;
                        return '';
                    };
                    
                    const ldContent = findContent(data);
                    if (ldContent && ldContent.length > content.length) {
                        content = ldContent;
                        if (data.headline && !title) title = data.headline;
                    }
                } catch (e) {}
            });
        }

        // 5. 终极兜底：所有 p 标签
        if (content.length < 50) {
            $('p').each((i, elem) => {
                const text = $(elem).text().trim();
                if (text.length > 20) content += text + '\n';
            });
        }
        
        // 6. 提取特色图片 (优先顺序: og:image -> twitter:image -> link[rel="image_src"])
        let imageUrl = $('meta[property="og:image"]').attr('content') || 
                       $('meta[name="twitter:image"]').attr('content') ||
                       $('link[rel="image_src"]').attr('href') ||
                       $('meta[name="thumbnail"]').attr('content');

        // 如果是相对路径，转换为绝对路径
        if (imageUrl && !imageUrl.startsWith('http')) {
            try {
                const urlObj = new URL(url);
                imageUrl = new URL(imageUrl, urlObj.origin).href;
            } catch (e) {
                imageUrl = null;
            }
        }
        
        console.log(`   ✅ 提取成功 - 标题: ${title.length}字符, 正文: ${content.length}字符${imageUrl ? ', 有图片' : ', 无图片'}`);
        return { title, content: content.slice(0, 8000), imageUrl }; // 限制内容长度

    } catch (error) {
        console.error(`   ❌ 提取内容失败 ${url}:`, error.message);
        return { title: '', content: '' };
    }
}

/**
 * 判断是否为干扰标题（如Google News的简报页）
 */
function isNoiseTitle(title) {
    if (!title) return false;
    const noiseKeywords = ['Your briefing', 'Google News', 'Google 新闻', 'Read more', '查看更多'];
    return noiseKeywords.some(keyword => title.includes(keyword));
}

module.exports = { extractNewsFromUrl, isNoiseTitle };
