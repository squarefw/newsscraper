/**
 * 新闻源分析器模块 - 改进版
 * 使用AI从新闻列表页HTML中发现与关键词相关的文章链接。
 */

const { URL } = require('url');

/**
 * 构建用于发现链接的AI Prompt
 */
const buildDiscoveryPrompt = (html, keywords, baseUrl) => {
  // 大幅增加HTML截取长度以获得页面主体内容
  const truncatedHtml = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                           .replace(/<style[\s\S]*?<\/style>/gi, '')
                           .replace(/\s+/g, ' ')
                           .substring(0, 50000);

  console.log(`   📝 HTML长度: ${html.length}, 截取后: ${truncatedHtml.length}`);

  return `
你是新闻网站的内容分析专家。请从HTML中找到新闻文章链接。

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

返回要求：
- 返回5-15个具体的新闻文章URL
- 如果找不到具体文章，可以包含看起来是新闻内容的链接
- JSON数组格式：["url1", "url2", ...]
- 相对路径要补全为完整URL

HTML代码:
\`\`\`html
${truncatedHtml}
\`\`\`
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
  
  console.log(`   🤖 正在使用AI分析HTML内容...`);
  const response = await aiAgent.processContent(prompt, 'custom');
  
  // 清理响应内容，移除可能的markdown代码块格式
  let cleanResponse = response.trim();
  console.log(`   📝 AI原始响应: ${response.substring(0, 200)}...`);
  
  if (cleanResponse.startsWith('```json')) {
    cleanResponse = cleanResponse.replace(/```json\s*/, '').replace(/```\s*$/, '');
  } else if (cleanResponse.startsWith('```')) {
    cleanResponse = cleanResponse.replace(/```\s*/, '').replace(/```\s*$/, '');
  }
  
  try {
    const links = JSON.parse(cleanResponse);
    console.log(`   ✅ 解析成功，发现 ${links.length} 个链接`);
    return Array.isArray(links) ? links : [];
  } catch (error) {
    console.error('   ❌ AI响应解析失败:', error.message);
    console.error('   原始响应:', response.substring(0, 500));
    console.error('   清理后响应:', cleanResponse.substring(0, 500));
    return [];
  }
};

module.exports = { findRelevantLinks };
