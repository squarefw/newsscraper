/**
 * WordPress 内容去重模块
 * 使用AI判断新发现的文章是否已在WordPress中存在
 */

/**
 * 构建用于去重判断的AI Prompt
 */
const buildDeduplicationPrompt = (newTitle, existingTitles) => {
  return `你是一位专业的新闻编辑和内容去重专家。你的任务是判断一篇新文章是否与已有文章重复。

重要说明：只有在新文章与已有文章报道完全相同的事件或内容时，才能判定为重复。

重复判断标准（必须同时满足）：
1. 相同核心事件：报道同一个具体事件、新闻或公告
2. 相同主题焦点：虽然用词不同，但核心关注点完全一致
3. 时效性考虑：同一时期发生的相同类型事件

不重复的情况包括：
- 相同主题但不同事件（如"A公司财报"与"B公司财报"）
- 相同主题但不同角度（如"房价上涨"与"购房建议"）
- 相同地区但不同事件（如"都柏林交通事故"与"都柏林新建设项目"）
- 相关但不相同的新闻（如"总理访问"与"总理政策"）

新文章标题: "${newTitle}"

已发布文章标题列表：
${existingTitles.map((title, index) => `${index + 1}. ${title}`).join('\n')}

请仔细分析，只有当新文章与列表中某篇文章报道完全相同的事件时才判定为重复。

判断示例：
- "都柏林市中心发生火灾" 与 "都柏林市中心建筑火灾事故" → 重复 (相同具体事件)
- "爱尔兰房价上涨5%" 与 "专家分析爱尔兰房价趋势" → 不重复 (不同角度)
- "政府宣布新经济政策" 与 "政府经济政策获得支持" → 不重复 (不同事件)
- "苹果公司发布新iPhone" 与 "苹果公司第三季度财报" → 不重复 (不同事件)

要求：宁可误判为不重复，也不要错误地标记为重复。

请只回答 "YES" (重复) 或 "NO" (不重复)。`;
};

const WordPressConnector = require('./wordpressConnector');
const { extractNewsFromUrl } = require('../article/newsExtractor');

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
    if (existingTitles.length === 0) {
      console.log(`[去重] WordPress中没有文章，视为新文章`);
      return false; // 如果没有可比对的标题，则视为不重复
    }

    const { title: newTitle, content: newContent } = await extractNewsFromUrl(articleUrl);
    
    // 检查内容提取是否成功
    if (!newTitle || newTitle.trim().length === 0) {
      console.log(`[去重] 无法提取文章标题，默认视为新文章`);
      return false; // 如果无法提取标题，保守处理：视为新文章
    }

    // 检查标题长度是否合理
    if (newTitle.trim().length < 10) {
      console.log(`[去重] 文章标题过短 (${newTitle.length}字符)，默认视为新文章`);
      return false;
    }

    const prompt = buildDeduplicationPrompt(newTitle.trim(), existingTitles);
    
    // 使用专门的去重AI引擎
    const aiAgent = aiManager.getAgentForTask('deduplication');
    const response = await aiAgent.processContent(prompt, 'deduplication');
    
    const isRepeated = response.trim().toUpperCase() === 'YES';
    console.log(`[去重] AI判断结果: ${isRepeated ? '重复' : '新文章'} (标题: ${newTitle.substring(0, 50)}...)`);
    
    return isRepeated;
  } catch (error) {
    console.error(`[去重] 检查URL ${articleUrl} 时出错:`, error.message);
    return false; // 出错时默认为不重复，避免错误地过滤掉新文章
  }
};

module.exports = { isDuplicate };