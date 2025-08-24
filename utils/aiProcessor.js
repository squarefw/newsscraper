/**
 * AI处理工具模块 (JavaScript版本)
 * 提供统一的AI任务处理功能，可被多个脚本复用
 * 支持多AI引擎分工合作
 */

const { getAllCategories } = require('./remoteCategoryManager');
const { MultiAIManager } = require('./multiAIManager');

/**
 * 获取任务中文名称
 */
const getTaskName = (task) => {
  const taskNames = {
    'translate': '翻译',
    'rewrite': '重写',
    'summarize': '摘要',
    'extract_keywords': '关键词提取',
    'categorize': '智能分类',
    'sentiment': '情感分析',
    'title_optimization': '标题优化'
  };
  return taskNames[task] || task;
};

/**
 * 生成AI分类提示词
 */
const generateCategoryPrompt = (content, categories) => {
  if (categories.length === 0) {
    return `请为以下新闻内容选择一个合适的分类：\n\n${content}`;
  }

  const categoryList = categories
    .map(cat => `- "${cat.name}"${cat.description ? `: ${cat.description}` : ''}`)
    .join('\n');

  return `你是一个专业的新闻分类专家。请从以下WordPress分类中选择最合适的一个分类：

可选分类列表（只能从中选择一个）：
${categoryList}

新闻内容：
${content.substring(0, 1000)}...

要求：
1. 只能选择上述分类列表中的一个
2. 直接返回分类名称，不要其他解释
3. 如果不确定，选择"${categories.find(cat => cat.name.includes('新闻') || cat.name.includes('未分类'))?.name || categories[0]?.name}"

请选择最合适的分类：`;
};

/**
 * 验证并获取分类ID
 */
const validateAndGetCategoryId = async (aiSelectedCategory, categories, fallbackCategory) => {
  if (!categories || categories.length === 0) {
    return null;
  }

  // 查找匹配的分类
  let matchedCategory = categories.find(cat => 
    cat.name.toLowerCase() === aiSelectedCategory.toLowerCase()
  );

  // 如果没有精确匹配，尝试模糊匹配
  if (!matchedCategory) {
    matchedCategory = categories.find(cat => 
      cat.name.toLowerCase().includes(aiSelectedCategory.toLowerCase()) ||
      aiSelectedCategory.toLowerCase().includes(cat.name.toLowerCase())
    );
  }

  // 如果仍然没有匹配，使用默认分类
  if (!matchedCategory) {
    const fallback = categories.find(cat => 
      cat.name === fallbackCategory ||
      cat.name.includes('新闻') ||
      cat.name.includes('未分类')
    ) || categories[0];
    
    console.log(`⚠️  AI选择的分类"${aiSelectedCategory}"不存在，使用默认分类"${fallback.name}"`);
    return fallback.id;
  }

  console.log(`✅ 分类匹配成功: "${aiSelectedCategory}" -> "${matchedCategory.name}" (ID: ${matchedCategory.id})`);
  return matchedCategory.id;
};

/**
 * 增强内容（添加来源链接等）
 */
const enhanceContent = (content, originalUrl, title, config) => {
  let enhancedContent = content;

  // 添加来源链接
  if (config.wordpress?.contentEnhancement?.addSourceLink) {
    const template = config.wordpress.contentEnhancement.sourceLinkTemplate || 
                    '\n\n---\n**来源链接**: [{title}]({url})';
    const sourceLink = template
      .replace('{title}', title)
      .replace('{url}', originalUrl);
    enhancedContent += sourceLink;
  }

  // 添加发布时间
  if (config.wordpress?.contentEnhancement?.addPublishDate) {
    const template = config.wordpress.contentEnhancement.publishDateTemplate || 
                    '\n\n*发布时间: {date}*';
    const publishDate = template.replace('{date}', new Date().toLocaleString('zh-CN'));
    enhancedContent += publishDate;
  }

  return enhancedContent;
};

/**
 * 执行AI任务序列 (增强版 - 支持 WordPress 分类约束和标题优化)
 */
const processNewsWithAI = async (multiAIManager, originalContent, tasks, wpCategories = [], config = {}) => {
  const results = [];
  let processedTitle = originalContent.title;
  let processedContent = originalContent.content;
  let keywords = '';
  let category = '';
  let sentiment = '';
  let summary = '';
  let categoryId = null;
  
  console.log(`🤖 开始AI处理流程 (${tasks.length}个任务)`);
  
  // 显示AI分工情况
  const stats = multiAIManager.getStats();
  console.log(`🎯 AI分工情况:`);
  console.log(`   默认引擎: ${stats.defaultEngine}`);
  console.log(`   可用引擎: ${stats.availableEngines.join(', ')}`);
  for (const [task, engine] of Object.entries(stats.taskMapping)) {
    console.log(`   ${task} -> ${engine}`);
  }
  
  // 首先处理标题翻译/重写
  if (tasks.includes('translate') || tasks.includes('rewrite')) {
    console.log(`   📝 首先处理标题优化...`);
    
    try {
      let titleResult;
      let titleAI;
      
      if (tasks.includes('translate') && processedTitle.match(/[a-zA-Z]/)) {
        // 如果包含英文字符，使用指定的标题翻译AI
        titleAI = multiAIManager.getAgentForTask('custom_title_translate');
        titleResult = await titleAI.processContent(processedTitle, 'custom_title_translate');
      } else {
        // 否则使用指定的标题生成AI
        titleAI = multiAIManager.getAgentForTask('custom_title_generate');
        titleResult = await titleAI.processContent(processedContent.substring(0, 500), 'custom_title_generate');
      }
      
      const newTitle = titleResult.trim().split('\n')[0]; // 取第一行
      
      if (newTitle && newTitle.length <= 50) {
        processedTitle = newTitle;
        console.log(`     ✅ 标题优化完成: ${processedTitle} [${titleAI.name}]`);
        
        results.push({
          task: 'title_optimization',
          taskName: '标题优化',
          aiEngine: titleAI.name,
          input: originalContent.title,
          output: processedTitle,
          duration: 0,
          success: true
        });
      } else {
        console.log(`     ⚠️ 标题长度不符合要求 (${newTitle ? newTitle.length : 0}字符)，使用原标题`);
      }
    } catch (error) {
      console.log(`     ⚠️ 标题优化失败: ${error.message}，使用原标题`);
    }
  }
  
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const startTime = Date.now();
    
    try {
      console.log(`   ${i + 1}/${tasks.length} 执行 ${task.toUpperCase()} - ${getTaskName(task)}`);
      
      // 根据任务获取对应的AI引擎
      const aiAgent = multiAIManager.getAgentForTask(task);
      
      let inputContent;
      let customPrompt = null;

      switch (task) {
        case 'translate':
          // 只翻译内容，标题已经处理过了
          inputContent = processedContent;
          break;
        case 'rewrite':
          // 只重写内容，标题已经处理过了
          inputContent = processedContent;
          break;
        case 'summarize':
          inputContent = processedContent;
          break;
        case 'extract_keywords':
          inputContent = processedContent;
          break;
        case 'categorize':
          inputContent = processedContent;
          // 使用增强的分类提示词
          if (config.wordpress?.categoryConstraints?.enabled && wpCategories.length > 0) {
            customPrompt = generateCategoryPrompt(inputContent, wpCategories);
            console.log(`     📂 使用WordPress分类约束 (${wpCategories.length}个可选分类)`);
          }
          break;
        case 'sentiment':
          inputContent = processedContent;
          break;
        default:
          inputContent = processedContent;
      }

      const result = customPrompt 
        ? await aiAgent.processContent(customPrompt, 'custom')
        : await aiAgent.processContent(inputContent, task);
      
      const duration = Date.now() - startTime;
      
      console.log(`     ✅ 完成 (${duration}ms) - 输出: ${result.length}字符 [${aiAgent.name}]`);
      
      // 更新处理后的内容用于下一个任务
      if (task === 'translate' || task === 'rewrite') {
        processedContent = result;
      }
      
      // 保存关键信息
      switch (task) {
        case 'extract_keywords':
          keywords = result;
          break;
        case 'categorize':
          category = result.trim();
          // 验证分类
          if (config.wordpress?.categoryConstraints?.enabled && wpCategories.length > 0) {
            categoryId = await validateAndGetCategoryId(
              category, 
              wpCategories, 
              config.wordpress.categoryConstraints.fallbackCategory
            );
            console.log(`     📂 分类验证: "${category}" -> ID: ${categoryId}`);
          }
          break;
        case 'sentiment':
          sentiment = result;
          break;
        case 'summarize':
          summary = result;
          break;
      }
      
      results.push({
        task,
        taskName: getTaskName(task),
        aiEngine: aiAgent.name,
        input: inputContent,
        output: result,
        duration,
        success: true
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`     ❌ 失败: ${error.message} (${duration}ms)`);
      
      results.push({
        task,
        taskName: getTaskName(task),
        aiEngine: 'unknown',
        input: processedContent,
        output: '',
        duration,
        success: false,
        error: error.message
      });
    }
  }
  
  return {
    originalTitle: originalContent.title,
    originalContent: originalContent.content,
    finalTitle: processedTitle,
    finalContent: processedContent,
    keywords,
    category,
    categoryId, // 添加categoryId到返回结果
    sentiment,
    summary,
    results
  };
};

/**
 * 解析关键词字符串为数组
 */
const parseKeywords = (keywordsString) => {
  if (!keywordsString) return [];
  
  const separators = [',', '，', ';', '；', '、', '\n', '|'];
  
  for (const sep of separators) {
    if (keywordsString.includes(sep)) {
      return keywordsString
        .split(sep)
        .map(keyword => keyword.trim())
        .filter(keyword => keyword.length > 0)
        .slice(0, 10);
    }
  }
  
  return keywordsString
    .split(/\s+/)
    .filter(keyword => keyword.length > 1)
    .slice(0, 10);
};

/**
 * 根据分类名称获取分类ID (用于自定义API)
 * @param {string} categoryName - 分类名称
 * @param {Object} categoryMapping - 可选的分类映射配置
 * @param {string} defaultCategoryId - 默认分类ID
 * @returns {string} 分类ID
 */
const getCategoryId = (categoryName, categoryMapping = null, defaultCategoryId = null) => {
  // 如果提供了自定义映射，使用自定义映射
  if (categoryMapping) {
    if (!categoryName) {
      return defaultCategoryId || Object.values(categoryMapping)[0] || 'uncategorized';
    }
    
    const lowerCategoryName = categoryName.toLowerCase();
    for (const [name, id] of Object.entries(categoryMapping)) {
      if (lowerCategoryName.includes(name.toLowerCase())) {
        return id;
      }
    }
    
    return defaultCategoryId || Object.values(categoryMapping)[0] || 'uncategorized';
  }
  
  // 如果没有提供映射，返回简化的分类名或默认值
  if (!categoryName) {
    return defaultCategoryId || 'uncategorized';
  }
  
  // 返回标准化的分类名（小写，去空格）
  return categoryName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
};

/**
 * 执行完整的AI处理流程（包括动态分类获取）
 * 支持多AI引擎分工合作
 */
const processNewsWithDynamicCategories = async (multiAIManager, originalContent, tasks, config = {}) => {
  console.log(`🔄 开始完整AI处理流程（包括动态分类获取）`);
  
  // 1. 获取远程分类信息
  const categoryInfo = await getAllCategories(config);
  
  if (categoryInfo.errors.length > 0) {
    console.log(`⚠️  分类获取警告:`);
    categoryInfo.errors.forEach(error => console.log(`   - ${error}`));
  }
  
  // 2. 执行AI处理（多AI引擎分工合作）
  const aiResult = await processNewsWithAI(
    multiAIManager,
    originalContent,
    tasks,
    categoryInfo.wordpress, // 使用动态获取的WordPress分类
    config
  );
  
  // 3. 返回完整结果，包括分类信息
  return {
    ...aiResult,
    categoryInfo: {
      customApiMapping: categoryInfo.customApi,
      wordpressCategories: categoryInfo.wordpress,
      errors: categoryInfo.errors
    }
  };
};

module.exports = {
  getTaskName,
  generateCategoryPrompt,
  validateAndGetCategoryId,
  enhanceContent,
  processNewsWithAI,
  processNewsWithDynamicCategories, // 新增的完整处理函数
  parseKeywords,
  getCategoryId
};
