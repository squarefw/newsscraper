/**
 * 新闻源分析器模块
 * 使用AI从新闻列表页HTML中发现与关键词相关的文章链接。
 */

const { URL } = require('url');

/**
 * 构建用于发现链接的AI Prompt
 */
const buildDiscoveryPrompt = (html, keywords, baseUrl) => {
  // 截取部分HTML以避免超出token限制
  const truncatedHtml = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                           .replace(/<style[\s\S]*?<\/style>/gi, '')
                           .replace(/\s+/g, ' ')
                           .substring(0, 15000);

  return `
你是一个新闻内容分析助手。这是新闻网站首页的部分HTML代码。
请仔细分析并找出所有指向独立新闻文章的链接。

你的任务是只选择那些链接文本或上下文与以下任一关键词高度相关的文章：
关键词: [${keywords.join(', ')}]

请忽略导航、广告、页脚、隐私政策或“关于我们”等无关链接。
以JSON数组的格式返回所有符合条件的、完整的URL。
如果链接是相对路径 (例如 /news/article/123)，请根据基础URL "${baseUrl}" 将其补全为完整URL。

HTML内容:
\`\`\`html
${truncatedHtml}
\`\`\`

要求:
1. 只返回一个JSON数组，不要任何其他解释。
2. 确保数组中的每个URL都是完整的、可直接访问的。
3. 如果找不到任何相关链接，返回一个空数组 []。
`;
};

/**
 * 从HTML中发现与关键词相关的链接
 * @param {string} pageHtml - 页面的HTML内容
 * @param {string[]} keywords - 相关关键词数组
 * @param {string} baseUrl - 页面的基础URL，用于补全相对链接
 * @param {MultiAIManager} aiManager - AI管理器实例
 * @returns {Promise<string[]>} - 发现的URL链接数组
 */
const findRelevantLinks = async (pageHtml, keywords, baseUrl, aiManager) => {
  const prompt = buildDiscoveryPrompt(pageHtml, keywords, baseUrl);
  const aiAgent = aiManager.getAgentForTask('summarize'); // 可以复用任何一个通用任务的AI
  
  const response = await aiAgent.processContent(prompt, 'custom');
  
  // 清理响应内容，移除可能的markdown代码块格式
  let cleanResponse = response.trim();
  if (cleanResponse.startsWith('```json')) {
    cleanResponse = cleanResponse.replace(/```json\s*/, '').replace(/```\s*$/, '');
  } else if (cleanResponse.startsWith('```')) {
    cleanResponse = cleanResponse.replace(/```\s*/, '').replace(/```\s*$/, '');
  }
  
  try {
    const links = JSON.parse(cleanResponse);
    return Array.isArray(links) ? links : [];
  } catch (error) {
    console.error('AI响应解析失败:', error.message);
    console.error('原始响应:', response);
    console.error('清理后响应:', cleanResponse);
    return [];
  }
};

module.exports = { findRelevantLinks };