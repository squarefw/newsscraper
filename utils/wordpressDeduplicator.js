/**
 * WordPress 内容去重模块
 * 使用AI判断新发现的文章是否已在WordPress中存在
 */

/**
 * 构建用于去重判断的AI Prompt
 */
const buildDeduplicationPrompt = (newTitle, existingTitles) => {
  return `你是一位专业的新闻编辑和内容去重专家。你的任务是判断一篇新文章是否与已有文章重复。

重复判断标准：
1. 相同核心事件：报道同一个具体事件、新闻或公告
2. 相同主题焦点：虽然用词不同，但核心关注点完全一致
3. 时效性考虑：同一时期发生的相同类型事件

新文章标题: "${newTitle}"

已发布文章标题列表：
${existingTitles.map((title, index) => `${index + 1}. ${title}`).join('\n')}

请仔细分析新文章标题与已发布文章列表，判断是否存在重复报道。

判断示例：
- "都柏林房价上涨5%" 与 "爱尔兰首都房产价格持续攀升" → 重复 (相同核心事件)
- "爱尔兰总理发表声明" 与 "爱尔兰总理谈经济政策" → 不重复 (不同具体内容)
- "某公司发布财报" 与 "某公司Q1营收增长" → 重复 (相同核心事件)

请只回答 "YES" (重复) 或 "NO" (不重复)。`;
};

const WordPressConnector = require('./wordpressConnector');
const { extractNewsFromUrl } = require('./newsExtractor');

let titleCache = null;
let cacheTimestamp = 0;

/**
 * 从WordPress获取最新文章的标题列表（带缓存）
 */
const getRecentWordPressTitles = async (config) => {
  const { deduplication } = config.discovery;
  const { wordpress } = config; // WordPress配置在根级别
  const now = Date.now();

  // 检查缓存
  if (titleCache && (now - cacheTimestamp) < deduplication.cacheDuration) {
    console.log(`[去重] 使用缓存的 ${titleCache.length} 个WordPress标题。`);
    return titleCache;
  }

  console.log('[去重] 正在从WordPress获取最新文章标题...');
  try {
    // 使用WordPressConnector而不是直接调用axios
    const wpConnector = new WordPressConnector(wordpress);
    
    // 获取最近的文章标题
    const posts = await wpConnector.getRecentPosts(deduplication.recentPostsCount || 50);
    
    const titles = posts.map(post => post.title);
    titleCache = titles;
    cacheTimestamp = now;
    console.log(`[去重] 成功获取 ${titles.length} 个标题并已缓存。`);
    return titles;
  } catch (error) {
    console.error('[去重] 获取WordPress标题失败:', error.message);
    
    // 如果是401错误，提供更详细的错误信息
    if (error.message.includes('401') || error.message.includes('UNAUTHORIZED')) {
      console.error('[去重] ❌ WordPress认证失败，可能原因：');
      console.error('  1. 用户名或密码错误');
      console.error('  2. 用户权限不足');
      console.error('  3. WordPress禁用了REST API和XML-RPC');
      console.error('  4. WordPress需要Application Password认证');
    }
    
    return []; // 失败时返回空数组，避免阻塞流程
  }
};

/**
 * 构建用于去重判断的AI Prompt
 */
/**
 * 检查指定URL的文章是否与WordPress中的文章重复
 * @param {string} articleUrl - 待检查的文章URL
 * @param {MultiAIManager} aiManager - AI管理器实例
 * @param {object} config - 完整的配置对象
 * @returns {Promise<boolean>} - 如果重复则返回true，否则返回false
 */

/**
 * 检查指定URL的文章是否与WordPress中的文章重复
 * @param {string} articleUrl - 待检查的文章URL
 * @param {MultiAIManager} aiManager - AI管理器实例
 * @param {object} config - 完整的配置对象
 * @returns {Promise<boolean>} - 如果重复则返回true，否则返回false
 */
const isDuplicate = async (articleUrl, aiManager, config) => {
  try {
    const existingTitles = await getRecentWordPressTitles(config);
    if (existingTitles.length === 0) return false; // 如果没有可比对的标题，则视为不重复

    const { title: newTitle } = await extractNewsFromUrl(articleUrl);
    const prompt = buildDeduplicationPrompt(newTitle, existingTitles);
    
    // 使用专门的去重AI引擎
    const aiAgent = aiManager.getAgentForTask('deduplication');
    const response = await aiAgent.processContent(prompt, 'deduplication');
    return response.trim().toUpperCase() === 'YES';
  } catch (error) {
    console.error(`[去重] 检查URL ${articleUrl} 时出错:`, error.message);
    return false; // 出错时默认为不重复，避免错误地过滤掉新文章
  }
};

module.exports = { isDuplicate };