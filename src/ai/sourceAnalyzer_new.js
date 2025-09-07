/**
 * 新闻源分析器模块 - 增强版
 * 支持Google News和传统新闻网站的智能分析
 */

const { URL } = require('url');
const cheerio = require('cheerio');

/**
 * 检测是否为Google News URL
 */
const isGoogleNews = (url) => {
  return url.includes('news.google.com');
};

/**
 * 构建Google News专用的AI Prompt
 */
const buildGoogleNewsPrompt = (html, keywords, baseUrl) => {
  // Google News页面使用大量JavaScript动态加载，需要特殊处理
  const truncatedHtml = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                           .replace(/<style[\s\S]*?<\/style>/gi, '')
                           .replace(/\s+/g, ' ')
                           .substring(0, 80000); // Google News页面较大，增加截取长度

  console.log(`   📝 Google News HTML长度: ${html.length}, 截取后: ${truncatedHtml.length}`);

  return `
你是Google News内容分析专家。请从Google News聚合页面HTML中提取真实的新闻文章链接。

IMPORTANT: 你必须直接返回JSON数组格式，不要有任何额外的解释、思考过程或markdown标记。

基础URL: ${baseUrl}
目标关键词: [${keywords.join(', ')}]

Google News特殊分析策略：
1. 查找所有包含外部新闻网站链接的<a>标签
2. Google News的链接通常格式为: ./articles/xxx 或 ./stories/xxx
3. 也可能有直接的外部链接，如 https://www.bbc.com/news/xxx
4. 寻找data-n-tid, data-ved等Google特有属性的链接
5. 优先选择与关键词相关的新闻标题

Google News链接特征：
- 通常包含 "./articles/" 或 "./stories/" 前缀
- 可能有 "?hl=en&gl=IE&ceid=IE:en" 等参数
- 有些链接指向原始新闻网站(BBC, RTE, Independent等)

排除规则：
- 不要Google内部功能链接 (search, account, settings等)
- 不要广告链接
- 不要导航菜单链接

必须返回格式：
["url1", "url2", "url3", ...]

返回10-20个新闻文章链接。对于./articles/格式的链接，保持原格式。

HTML代码:
\`\`\`html
${truncatedHtml}
\`\`\`
`;
};

/**
 * 构建传统新闻网站的AI Prompt
 */
const buildStandardNewsPrompt = (html, keywords, baseUrl) => {
  const truncatedHtml = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                           .replace(/<style[\s\S]*?<\/style>/gi, '')
                           .replace(/\s+/g, ' ')
                           .substring(0, 50000);

  console.log(`   📝 传统新闻网站HTML长度: ${html.length}, 截取后: ${truncatedHtml.length}`);

  return `
你是新闻网站的内容分析专家。请从HTML中找到新闻文章链接。

IMPORTANT: 你必须直接返回JSON数组格式，不要有任何额外的解释、思考过程或markdown标记。

基础URL: ${baseUrl}
目标关键词: [${keywords.join(', ')}]

分析策略：
1. 查找页面中所有的<a>标签链接
2. 优先寻找带有文章标题的链接
3. 文章标题通常包含时事、人名、地名、事件等
4. 如果有关键词匹配的文章就优先选择
5. 如果没有，也可以选择一般的热门新闻文章

排除规则：
- 不要分类页面 (/news/business, /technology等)
- 不要导航链接 (Home, About, Contact等)
- 不要功能链接 (Login, Register, Subscribe等)

必须返回格式：
["url1", "url2", "url3", ...]

返回5-15个具体的新闻文章URL。相对路径要补全为完整URL。

HTML代码:
\`\`\`html
${truncatedHtml}
\`\`\`
`;
};

/**
 * 处理Google News的特殊链接格式（RSS版本）
 */
const processGoogleNewsLinks = (articles, baseUrl) => {
  // RSS方法返回的文章已经是正确格式，但Cheerio后备方法可能返回相对链接
  return articles.map(article => {
    if (!article || !article.url) {
        return null;
    }
    let link = article.url;

    // 如果是Cheerio提取的相对路径，补全为绝对路径
    if (link.startsWith('./')) {
      try {
        link = new URL(link, baseUrl).href;
        // console.log(`   🔗 Resolved relative link to: ${link}`);
      } catch (e) {
        console.error(`   ❌ Failed to resolve relative URL: ${link} with base ${baseUrl}`);
        return null;
      }
    }
    
    // 过滤掉明显的无效链接
    if (link.includes('google.com/search') || 
        link.includes('accounts.google.com') ||
        link.includes('support.google.com')) {
      return null;
    }
    
    return { 
      url: link, 
      date: article.date,
      title: article.title,
      source: article.source
    };
  }).filter(Boolean); // Remove null entries
};

/**
 * 处理传统新闻网站链接
 */
const processStandardNewsLinks = (articles, baseUrl) => {
  // This function is now mostly redundant as extractStandardLinksWithCheerio handles it.
  // Kept for structure, but just passes through.
  return articles;
};

/**
 * 使用RSS从Google News中提取链接和日期（新方法）
 */
const extractLinksWithRSS = async (url, baseUrl, options = {}) => {
  try {
    const RSSGoogleNewsAnalyzer = require('./rssGoogleNewsAnalyzer');
    const analyzer = new RSSGoogleNewsAnalyzer();
    
    console.log(`🔍 Using RSS method for Google News: ${url}`);
    
    const result = await analyzer.processGoogleNewsUrl(url, options);
    
    if (result.success) {
      console.log(`✅ RSS extraction successful: ${result.processed} articles`);
      return result.articles;
    } else {
      console.log(`❌ RSS extraction failed: ${result.error}`);
      return [];
    }
  } catch (error) {
    console.error(`❌ RSS extraction error: ${error.message}`);
    return [];
  }
};

/**
 * 使用Cheerio从Google News HTML中提取链接和日期（传统方法，作为后备）
 */
const extractLinksWithCheerio = (html, baseUrl) => {
  const $ = cheerio.load(html);
  const articles = []; // Store objects with url and date

  // Google News的链接通常在带有特定属性的a标签中
  $('a[href^="./articles/"], a[href^="./stories/"], a[href^="./read/"]').each((i, elem) => {
    const href = $(elem).attr('href');
    if (href) {
      console.log(`   🔍 Found Google News link: ${href}`);
      // 尝试找到此链接最近的父级文章节点，然后从中寻找时间戳
      const articleNode = $(elem).closest('article, [jscontroller]');
      let date = null;
      if (articleNode.length > 0) {
        const timeElem = articleNode.find('time[datetime]');
        if (timeElem.length > 0) {
          const datetime = timeElem.attr('datetime');
          if (datetime) {
            date = new Date(datetime);
          }
        }
      }
      articles.push({ url: href, date: date });
    }
  });

  console.log(`   Cheerio extracted ${articles.length} initial article entries.`);
  return articles;
};

/**
 * 使用Cheerio从标准新闻网站HTML中提取链接（非AI方法）
 */
const extractStandardLinksWithCheerio = (html, baseUrl) => {
  const $ = cheerio.load(html);
  const articles = [];
  const baseUrlObj = new URL(baseUrl);
  const seenUrls = new Set();

  $('a[href]').each((i, elem) => {
    let href = $(elem).attr('href');
    if (href && href.trim() !== '' && !href.startsWith('#') && !href.startsWith('javascript:')) {
      try {
        const absoluteUrl = new URL(href, baseUrlObj.href).href;
        // 过滤掉明显不是文章的链接
        if (!seenUrls.has(absoluteUrl) && absoluteUrl.startsWith(baseUrlObj.origin) && absoluteUrl.length > (baseUrlObj.origin.length + 10)) {
           // For standard sites, we don't have a reliable way to get the date from the list view.
           articles.push({ url: absoluteUrl, date: null });
           seenUrls.add(absoluteUrl);
        }
      } catch (e) {
        // 忽略无效的URL
      }
    }
  });
  
  console.log(`   Cheerio extracted ${articles.length} initial links.`);
  return articles;
};

/**
 * 从HTML中发现与关键词相关的链接 - 增强版（支持RSS）
 * @param {string} pageHtml - 页面的HTML内容
 * @param {string[]} keywords - 相关关键词数组
 * @param {string} baseUrl - 页面的基础URL，用于补全相对链接
 * @param {MultiAIManager} aiManager - AI管理器实例
 * @returns {Promise<{url: string, date: Date | null}[]>} - 发现的URL链接数组
 */
const findRelevantLinks = async (pageHtml, keywords, baseUrl, aiManager, options = {}) => {
  const isGoogleNewsPage = isGoogleNews(baseUrl);
  const { testMode = false } = options;
  
  console.log(`   Detected ${isGoogleNewsPage ? 'Google News' : 'a standard news site'}`);
  if (testMode && isGoogleNewsPage) {
    console.log(`   🧪 测试模式：将限制RSS解码的URL数量`);
  }

  let rawItems = [];

  if (isGoogleNewsPage) {
    // 对于Google News，优先使用RSS方法
    console.log('   Using RSS method for Google News...');
    try {
      rawItems = await extractLinksWithRSS(baseUrl, baseUrl, { testMode });
      if (rawItems.length === 0) {
        console.log('   RSS method failed, falling back to Cheerio...');
        rawItems = extractLinksWithCheerio(pageHtml, baseUrl);
      }
    } catch (error) {
      console.log(`   RSS method error: ${error.message}, falling back to Cheerio...`);
      rawItems = extractLinksWithCheerio(pageHtml, baseUrl);
    }
  } else {
    // 对于标准新闻网站，使用Cheerio
    console.log('   Using Cheerio for standard news site...');
    rawItems = extractStandardLinksWithCheerio(pageHtml, baseUrl);
  }
  
  const processedItems = isGoogleNewsPage
    ? processGoogleNewsLinks(rawItems, baseUrl)
    : processStandardNewsLinks(rawItems, baseUrl);

  console.log(`   Link extraction successful. Found ${rawItems.length} raw items, processed into ${processedItems.length} valid items.`);
  
  const uniqueUrls = new Set();
  const uniqueItems = processedItems.filter(item => {
    if (!item || !item.url) return false;
    if (uniqueUrls.has(item.url)) {
      return false;
    } else {
      uniqueUrls.add(item.url);
      return true;
    }
  });

  console.log(`   Remaining ${uniqueItems.length} unique links after deduplication.`);
  return uniqueItems;
  // --- END TEMPORARY WORKAROUND ---

  /*
  if (isGoogleNewsPage) {
    console.log('   💡 使用Cheerio进行Google News链接提取...');
    const rawLinks = extractLinksWithCheerio(pageHtml, baseUrl);
    const processedLinks = processGoogleNewsLinks(rawLinks, baseUrl);
    console.log(`   ✅ Cheerio解析成功，发现 ${rawLinks.length} 个原始链接，处理后得到 ${processedLinks.length} 个有效链接`);
    const uniqueLinks = [...new Set(processedLinks)];
    console.log(`   🔄 去重后剩余 ${uniqueLinks.length} 个唯一链接`);
    return uniqueLinks;
  }
  */
  
  // 传统新闻网站仍然使用AI进行分析
  const prompt = buildStandardNewsPrompt(pageHtml, keywords, baseUrl);
  
  const aiAgent = aiManager.getAgentForTask('summarize');
  
  console.log(`   AI processing ${isGoogleNewsPage ? 'Google News' : 'standard news'} content...`);
  const response = await aiAgent.processContent(prompt, 'custom');
  
  // 清理响应内容，移除可能的markdown代码块格式
  let cleanResponse = response.trim();
  console.log(`   Raw AI response: ${response.substring(0, 200)}...`);
  
  if (cleanResponse.startsWith('```json')) {
    cleanResponse = cleanResponse.replace(/```json\s*/, '').replace(/```\s*$/, '');
  } else if (cleanResponse.startsWith('```')) {
    cleanResponse = cleanResponse.replace(/```\s*/, '').replace(/```\s*$/, '');
  }
  
  try {
    const rawLinks = JSON.parse(cleanResponse);
    if (!Array.isArray(rawLinks)) {
      console.warn('   Warning: AI did not return an array.');
      return [];
    }
    
    // 根据网站类型处理链接
    const processedLinks = isGoogleNewsPage 
      ? processGoogleNewsLinks(rawLinks, baseUrl)
      : processStandardNewsLinks(rawLinks, baseUrl);
    
    console.log(`   Successfully parsed. Found ${rawLinks.length} raw links, processed into ${processedLinks.length} valid links.`);
    
    // 去重
    const uniqueLinks = [...new Set(processedLinks)];
    console.log(`   Remaining ${uniqueLinks.length} unique links after deduplication.`);
    
    return uniqueLinks;
  } catch (error) {
    console.error('   Error parsing AI response:', error.message);
    
    // 尝试从响应中提取JSON数组
    const jsonMatch = cleanResponse.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      try {
        console.log('   Attempting to extract JSON from response...');
        const extractedJson = JSON.parse(jsonMatch[0]);
        if (Array.isArray(extractedJson)) {
          console.log('   Successfully extracted JSON array.');
          const processedLinks = isGoogleNewsPage 
            ? processGoogleNewsLinks(extractedJson, baseUrl)
            : processStandardNewsLinks(extractedJson, baseUrl);
          return [...new Set(processedLinks)];
        }
      } catch (extractError) {
        console.error('   JSON extraction also failed.');
      }
    }
    
    console.error('   Original response:', response.substring(0, 500));
    console.error('   Cleaned response:', cleanResponse.substring(0, 500));
    return [];
  }
};

module.exports = { findRelevantLinks, isGoogleNews };
