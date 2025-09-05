const https = require('https');
const cheerio = require('cheerio');
const { 
  getOriginalNewsLinksFromTopic, 
  debugDecodeUrl 
} = require('./puppeteerResolver_enhanced');

/**
 * 全新的基于RSS的Google News源分析器
 * 这个方法避免了HTML页面的cookie同意问题
 */
class RSSGoogleNewsAnalyzer {
  constructor() {
    this.baseRSSUrl = 'https://news.google.com/rss';
  }

  /**
   * 获取RSS源的原始数据
   */
  async fetchRSSFeed(topicUrl) {
    return new Promise((resolve, reject) => {
      // 如果没有提供topicUrl，使用默认的Google News RSS
      const rssUrl = topicUrl ? this.convertToRSSUrl(topicUrl) : this.baseRSSUrl;
      
      console.log(`🔍 Fetching RSS feed: ${rssUrl}`);
      
      this.fetchRSSFeedDirect(rssUrl).then(resolve).catch(reject);
    });
  }

  /**
   * 直接获取RSS源数据（不进行URL转换）
   */
  async fetchRSSFeedDirect(rssUrl) {
    return new Promise((resolve, reject) => {
      console.log(`🔍 Fetching RSS feed directly: ${rssUrl}`);
      
      const req = https.get(rssUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)',
          'Accept': 'application/rss+xml, application/xml, text/xml',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        timeout: 15000
      }, (res) => {
        // 处理重定向
        if (res.statusCode === 301 || res.statusCode === 302) {
          const redirectUrl = res.headers.location;
          console.log(`🔄 Following redirect to: ${redirectUrl}`);
          // 直接使用重定向URL，不要再次转换
          return this.fetchRSSFeedDirect(redirectUrl).then(resolve).catch(reject);
        }
        
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log(`📄 Received ${data.length} characters of RSS data`);
          resolve(data);
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * 将HTML主题URL转换为RSS URL
   */
  convertToRSSUrl(htmlUrl) {
    if (htmlUrl.includes('/rss/')) {
      return htmlUrl; // 已经是RSS URL
    }
    
    // 从HTML URL提取主题ID
    const topicMatch = htmlUrl.match(/topics\/([^?]+)/);
    if (topicMatch) {
      const topicId = topicMatch[1];
      const params = new URL(htmlUrl).searchParams;
      
      let rssUrl = `${this.baseRSSUrl}/topics/${topicId}`;
      
      // 保留重要参数
      const queryParams = [];
      if (params.get('ceid')) queryParams.push(`ceid=${params.get('ceid')}`);
      if (params.get('hl')) queryParams.push(`hl=${params.get('hl')}`);
      if (params.get('gl')) queryParams.push(`gl=${params.get('gl')}`);
      
      if (queryParams.length > 0) {
        rssUrl += '?' + queryParams.join('&');
      }
      
      return rssUrl;
    }
    
    // 如果不是主题URL，可能是搜索或其他类型
    throw new Error(`Cannot convert URL to RSS format: ${htmlUrl}`);
  }

  /**
   * 解析RSS XML并提取文章
   */
  parseRSSFeed(rssData) {
    const articles = [];
    
    // 使用正则表达式解析RSS项目
    const itemPattern = /<item[^>]*>(.*?)<\/item>/gs;
    const items = [...rssData.matchAll(itemPattern)];
    
    console.log(`📰 Found ${items.length} RSS items`);
    
    items.forEach((item, index) => {
      try {
        const itemContent = item[1];
        
        // 提取标题
        const titleMatch = itemContent.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/s) ||
                          itemContent.match(/<title>(.*?)<\/title>/s);
        const title = titleMatch ? titleMatch[1].trim() : null;
        
        // 提取链接
        const linkMatch = itemContent.match(/<link>(.*?)<\/link>/s);
        const link = linkMatch ? linkMatch[1].trim() : null;
        
        // 提取发布日期
        const pubDateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/s);
        const pubDate = pubDateMatch ? new Date(pubDateMatch[1].trim()) : null;
        
        // 提取来源
        const sourceMatch = itemContent.match(/<source[^>]*>(.*?)<\/source>/s);
        const source = sourceMatch ? sourceMatch[1].trim() : null;
        
        // 提取描述
        const descMatch = itemContent.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/s) ||
                         itemContent.match(/<description>(.*?)<\/description>/s);
        const description = descMatch ? descMatch[1].trim() : null;
        
        if (title && link) {
          articles.push({
            title: title,
            url: link,
            date: pubDate,
            source: source,
            description: description,
            rawContent: itemContent.substring(0, 200) + '...' // Debug信息
          });
        }
      } catch (error) {
        console.log(`⚠️  Error parsing RSS item ${index + 1}: ${error.message}`);
      }
    });
    
    return articles;
  }

  /**
   * 从日期字符串过滤文章（只保留昨天凌晨到现在的）
   */
  filterByDate(articles) {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0); // 昨天凌晨
    
    console.log(`🗓️  Filtering articles from ${yesterday.toISOString()} to ${now.toISOString()}`);
    
    const filteredArticles = articles.filter(article => {
      if (!article.date) return false;
      return article.date >= yesterday && article.date <= now;
    });
    
    console.log(`📊 Filtered ${filteredArticles.length} articles from ${articles.length} total`);
    return filteredArticles;
  }

  /**
   * 主处理方法
   */
  async processGoogleNewsUrl(htmlUrl, options = {}) {
    try {
      const { testMode = false } = options;
      console.log(`🚀 开始处理Google News URL: ${htmlUrl}`);
      if (testMode) {
        console.log(`🧪 测试模式：将限制URL解码数量为5个`);
      }
      
      // 使用增强版解析器直接获取原始链接
      console.log(`🔧 使用简化解析器解码URL...`);
      const articleItems = await getOriginalNewsLinksFromTopic(htmlUrl, {
        enablePuppeteer: true, // 启用Puppeteer作为备用方案
        testMode: testMode     // 传递测试模式
      });
      
      if (articleItems.length === 0) {
        console.log(`❌ 简化解析器未获取到任何链接`);
        
        return {
          sourceUrl: htmlUrl,
          totalFound: 0,
          filtered: 0,
          processed: 0,
          articles: [],
          success: false,
          method: 'Enhanced_Resolver',
          error: 'No links found'
        };
      }
      
      // 转换为article格式，保留时间戳信息
      const articles = articleItems.map((item, index) => {
        let articleDate;
        let articleUrl;
        
        if (typeof item === 'string') {
          // 如果是字符串，说明是旧格式，使用当前时间
          articleUrl = item;
          articleDate = new Date();
        } else {
          // 如果是对象，使用时间戳信息
          articleUrl = item.url;
          articleDate = item.date || new Date();
        }
        
        return {
          title: `新闻文章 ${index + 1}`,
          url: articleUrl,
          date: articleDate,
          source: this.extractSourceFromUrl(articleUrl),
          originalUrl: articleUrl // 标记这是已解码的原始URL
        };
      });
      
      console.log(`\n📋 增强版解析器最终结果: ${articles.length} 个原始链接`);
      
      articles.forEach((article, i) => {
        console.log(`\n${i + 1}. ${article.title}`);
        console.log(`   📅 ${article.date ? article.date.toISOString() : 'No date'}`);
        console.log(`   📰 ${article.source || 'No source'}`);
        console.log(`   🔗 ${article.url.substring(0, 80)}...`);
      });
      
      return {
        sourceUrl: htmlUrl,
        totalFound: articleItems.length,
        filtered: articleItems.length,
        processed: articles.length,
        articles: articles,
        success: true,
        method: 'Enhanced_Resolver'
      };
      
    } catch (error) {
      console.error(`❌ Error processing ${htmlUrl}: ${error.message}`);
      return {
        sourceUrl: htmlUrl,
        error: error.message,
        success: false,
        method: 'Enhanced_Resolver'
      };
    }
  }

  /**
   * 从URL中提取新闻源名称
   */
  extractSourceFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace('www.', '');
      
      // 将域名转换为可读的源名称
      const domainMapping = {
        'bbc.co.uk': 'BBC',
        'cnn.com': 'CNN',
        'reuters.com': 'Reuters',
        'theguardian.com': 'The Guardian',
        'independent.ie': 'Irish Independent',
        'rte.ie': 'RTÉ',
        'thejournal.ie': 'TheJournal.ie',
        'irishtimes.com': 'Irish Times'
      };
      
      return domainMapping[hostname] || hostname;
    } catch (error) {
      console.error(`❌ Error extracting source from URL: ${error.message}`);
      return 'Unknown Source';
    }
  }

  /**
   * 尝试从URL中提取时间戳信息
   */
  extractTimeFromUrl(url) {
    try {
      // 1. 尝试从URL路径中提取日期模式
      const datePatterns = [
        /\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//,  // /2024/08/26/
        /\/(\d{4})-(\d{1,2})-(\d{1,2})\//,   // /2024-08-26/
        /\/(\d{4})(\d{2})(\d{2})\//,         // /20240826/
      ];

      for (const pattern of datePatterns) {
        const match = url.match(pattern);
        if (match) {
          const year = parseInt(match[1]);
          const month = parseInt(match[2]) - 1; // JavaScript月份是0-11
          const day = parseInt(match[3]);
          
          // 验证日期有效性
          if (year >= 2020 && year <= 2030 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
            const extractedDate = new Date(year, month, day);
            console.log(`   📅 从URL提取到日期: ${extractedDate.toISOString()}`);
            return extractedDate;
          }
        }
      }

      // 2. 如果URL中没有日期模式，使用当前时间
      return new Date();
      
    } catch (error) {
      console.error(`❌ Error extracting time from URL: ${error.message}`);
      return new Date(); // 返回当前时间作为默认值
    }
  }
}

// 测试新的RSS分析器
async function testRSSAnalyzer() {
  const analyzer = new RSSGoogleNewsAnalyzer();
  
  // 使用我们配置中的Google News URL
  const testUrl = 'https://news.google.com/topics/CAAqJQgKIh9DQkFTRVFvSUwyMHZNREpqWm5RU0JXVnVMVWRDS0FBUAE?ceid=IE:en&oc=3';
  
  console.log('🧪 Testing RSS-based Google News analyzer...\n');
  
  const result = await analyzer.processGoogleNewsUrl(testUrl);
  
  console.log('\n📊 Test Results:');
  console.log(JSON.stringify(result, null, 2));
}

// 直接测试如果运行此文件
if (require.main === module) {
  testRSSAnalyzer().catch(console.error);
}

module.exports = RSSGoogleNewsAnalyzer;
