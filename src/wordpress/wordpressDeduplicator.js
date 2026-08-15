/**
 * WordPress 内容去重模块
 * 使用AI判断新发现的文章是否与当前运行中已处理的文章重复
 */

const fs = require('fs');
const path = require('path');
const { extractNewsFromUrl } = require('../article/newsExtractor');

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

const storageDir = path.resolve(__dirname, '../../temp');
const storageFile = path.join(storageDir, 'processed-articles.json');

const ensureStorageReady = () => {
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
  if (!fs.existsSync(storageFile)) {
    fs.writeFileSync(storageFile, JSON.stringify({ articles: [] }, null, 2), 'utf8');
  }
};

const normalizeTitle = (title = '') => title.replace(/\s+/g, ' ').trim().toLowerCase();

const readProcessedArticles = () => {
  ensureStorageReady();
  try {
    const raw = fs.readFileSync(storageFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.articles)) {
      return parsed.articles;
    }
    return [];
  } catch (error) {
    console.warn('[去重] 无法读取已处理文章缓存，使用空列表:', error.message);
    return [];
  }
};

const writeProcessedArticles = (articles) => {
  ensureStorageReady();
  const payload = {
    updatedAt: new Date().toISOString(),
    articles: articles
  };
  fs.writeFileSync(storageFile, JSON.stringify(payload, null, 2), 'utf8');
};

const getProcessedArticles = () => readProcessedArticles();

const getProcessedTitles = (articles = getProcessedArticles()) => {
  const unique = new Map();
  articles.forEach(article => {
    if (!article || !article.title) return;
    const normalized = normalizeTitle(article.title);
    if (!unique.has(normalized)) {
      unique.set(normalized, article.title);
    }
  });
  return Array.from(unique.values());
};

const recordProcessedArticle = ({ title, url, sourceUrl }) => {
  if (!title) return;
  const normalizedTitle = normalizeTitle(title);
  if (!normalizedTitle) return;

  const articles = getProcessedArticles();
  const exists = articles.some(item => item.normalizedTitle === normalizedTitle);
  if (exists) {
    return;
  }

  const entry = {
    title,
    normalizedTitle,
    url: url || null,
    sourceUrl: sourceUrl || null,
    processedAt: new Date().toISOString()
  };

  const updated = [...articles, entry];
  writeProcessedArticles(updated);
  console.log(`[去重] 已缓存文章标题: ${title}`);
};

const resetProcessedArticles = () => {
  writeProcessedArticles([]);
  console.log('[去重] 已重置本次运行的已处理文章缓存');
};

/**
 * 检查指定URL的文章是否与已处理文章重复
 * @param {string} articleUrl - 待检查的文章URL
 * @param {MultiAIManager} aiManager - AI管理器实例
 * @param {object} config - 完整的配置对象
 * @returns {Promise<boolean>} - 如果重复则返回true，否则返回false
 */
const isDuplicate = async (articleUrl, aiManager, config) => {
  try {
    const { title: newTitle } = await extractNewsFromUrl(articleUrl);

    if (!newTitle || newTitle.trim().length === 0) {
      console.log(`[去重] 无法提取文章标题，默认视为新文章`);
      return false;
    }

    if (newTitle.trim().length < 10) {
      console.log(`[去重] 文章标题过短 (${newTitle.length}字符)，默认视为新文章`);
      return false;
    }

    const normalizedNewTitle = normalizeTitle(newTitle);
    const processedArticles = getProcessedArticles();

    if (processedArticles.length === 0) {
      console.log('[去重] 当前缓存为空，视为新文章');
      return false;
    }

    const hasExactMatch = processedArticles.some(article => article.normalizedTitle === normalizedNewTitle);
    if (hasExactMatch) {
      console.log(`[去重] 标题与已处理文章完全匹配，判定为重复: ${newTitle.substring(0, 50)}...`);
      return true;
    }

    const existingTitles = getProcessedTitles(processedArticles);
    const prompt = buildDeduplicationPrompt(newTitle.trim(), existingTitles);

    const aiAgent = aiManager.getAgentForTask('deduplication');
    const response = await aiAgent.processContent(prompt, 'deduplication');

    const isRepeated = response.trim().toUpperCase() === 'YES';
    console.log(`[去重] AI判断结果: ${isRepeated ? '重复' : '新文章'} (标题: ${newTitle.substring(0, 50)}...)`);

    return isRepeated;
  } catch (error) {
    console.error(`[去重] 检查URL ${articleUrl} 时出错:`, error.message);
    return false;
  }
};

module.exports = {
  isDuplicate,
  recordProcessedArticle,
  resetProcessedArticles,
  getProcessedArticles,
  getProcessedTitles
};
