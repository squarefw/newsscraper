/**
 * AI处理工具模块 (JavaScript版本)
 * 提供统一的AI任务处理功能，可被多个脚本复用
 * 支持多AI引擎分工合作
 */

const { getAllCategories } = require('../wordpress/remoteCategoryManager');
const { MultiAIManager } = require('./multiAIManager');

/**
 * 评估标题质量 - 检查标题是否符合新闻标题标准
 */
const evaluateTitleQuality = (title, content = '') => {
  if (!title || typeof title !== 'string') {
    return { score: 0, issues: ['标题为空'], isGood: false, needsRegeneration: true };
  }
  
  const trimmedTitle = title.trim();
  const issues = [];
  let score = 100;
  
  // 检查是否包含英文字符（如果是中文媒体，纯英文标题应该极低分强制重生）
  if (/[a-zA-Z]{5,}/.test(trimmedTitle) && !/[\u4e00-\u9fff]/.test(trimmedTitle)) {
    issues.push('标题为纯英文');
    score -= 60; // 强制进入重填
  }
  
  // 检查抽象开头（严重问题）
  const abstractStarters = ['根据', '关于', '基于', '针对', '按照', '依照', '为了', '由于'];
  if (abstractStarters.some(starter => trimmedTitle.startsWith(starter))) {
    issues.push('标题以抽象词语开头');
    score -= 50; // 严重扣分
  }
  
  // 检查长度
  if (trimmedTitle.length < 5) {
    issues.push('标题过短');
    score -= 30;
  } else if (trimmedTitle.length > 30) {
    issues.push('标题过长');
    score -= 20;
  }
  
  // 检查是否包含具体信息
  const hasSpecificInfo = /[A-Za-z\u4e00-\u9fff]{2,}/.test(trimmedTitle) && 
                         (/(发布|推出|签署|宣布|召开|举行|启动|完成|获得|达成|诉讼|抗议|游行)/.test(trimmedTitle) ||
                          /(公司|集团|政府|法院|学校|医院)/.test(trimmedTitle));
  
  if (!hasSpecificInfo) {
    issues.push('缺乏具体信息');
    score -= 25;
  }
  
  return {
    score: Math.max(0, score),
    issues,
    isGood: score >= 70,
    needsRegeneration: score < 50
  };
};

/**
 * 从AI处理结果中智能提取标题和正文
 * 期望格式：第一行是标题，第二行空行，第三行开始是正文
 */
const extractTitleAndContent = (aiResult) => {
  if (!aiResult || typeof aiResult !== 'string') {
    return { title: null, content: aiResult };
  }
  
  // 清理AI输出，移除HTML代码和多余内容
  let cleanedResult = aiResult
    .replace(/<iframe[^>]*>.*?<\/iframe>/gs, '') // 移除iframe标签
    .replace(/```html[\s\S]*?```/g, '') // 移除HTML代码块
    .replace(/```[\s\S]*?```/g, '') // 移除所有代码块
    .replace(/如需嵌入此文章[\s\S]*$/g, '') // 移除嵌入说明
    .trim();
  
  const lines = cleanedResult.split('\n');
  
  // AI处理说明文字的模式（需要跳过的行）
  const processingIndicators = [
    /^以下是.*?(翻译|重写|改写|处理).*?(:：)?\s*$/,
    /^(翻译|重写|改写|处理)(结果|如下|完成).*?(:：)?\s*$/,
    /^(译文|新闻|内容|文本|稿件)(重写|翻译|如下|内容).*?(:：)?\s*$/,
    /^新闻(重写|翻译|改写)如下.*?(:：)?\s*$/,
    /^(以下|下面)是.*?(后的|的)(内容|新闻|文章).*?(:：)?\s*$/,
    /^根据.*?要求.*?(翻译|重写|改写).*?(:：)?\s*$/
  ];
  
  let titleLineIndex = 0;
  let contentStartIndex = 0;
  
  // 查找真正的标题行（跳过AI处理说明文字）
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) continue; // 跳过空行
    
    // 检查是否是AI处理说明文字
    const isProcessingIndicator = processingIndicators.some(pattern => pattern.test(line));
    
    if (isProcessingIndicator) {
      continue; // 跳过处理说明文字
    }
    
    // 找到第一个非处理说明的有内容行
    titleLineIndex = i;
    break;
  }
  
  if (titleLineIndex >= lines.length) {
    // 没找到有效内容行
    return { title: null, content: cleanedResult };
  }
  
  // 提取第一行内容
  const firstLine = lines[titleLineIndex].trim();
  
  // 检查这一行是否像一个标题（短且不包含句号逗号）
  const isTitleLike = firstLine.length <= 30 && 
                      !firstLine.includes('。') && 
                      !firstLine.includes('，');
  
  let extractedTitle = null;
  
  if (isTitleLike) {
    // 这一行本身就是标题
    extractedTitle = firstLine;
    contentStartIndex = titleLineIndex + 1;
    // 跳过标题后的空行
    while (contentStartIndex < lines.length && lines[contentStartIndex].trim() === '') {
      contentStartIndex++;
    }
  } else {
    // 第一行是正文，需要从正文中提取标题
    contentStartIndex = titleLineIndex;
    
    // 尝试多种标题生成策略
    
    // 策略1：人数+地点+行动模式
    const pattern1 = firstLine.match(/^(数[^，。]*?)(?:在|聚集|举行|召开|进行)([^，。]*?).*?(游行|集会|抗议|活动|会议)/);
    if (pattern1) {
      extractedTitle = `${pattern1[1]}${pattern1[2]}${pattern1[3]}`;
    }
    
    // 策略2：取第一个逗号前的内容
    if (!extractedTitle) {
      const beforeComma = firstLine.split('，')[0];
      if (beforeComma.length >= 8 && beforeComma.length <= 25) {
        extractedTitle = beforeComma;
      }
    }
    
    // 策略3：取前15个字符作为标题
    if (!extractedTitle) {
      const shortTitle = firstLine.substring(0, 15);
      if (shortTitle.length >= 8) {
        extractedTitle = shortTitle;
      }
    }
  }
  
  // 清理标题中的标记符号
  if (extractedTitle) {
    extractedTitle = extractedTitle
      .replace(/^#+\s*/, '') // 去掉markdown标题符号 #
      .replace(/^\*+\s*/, '') // 去掉星号
      .replace(/^-+\s*/, '') // 去掉横线
      .replace(/^[•·]\s*/, '') // 去掉列表符号
      .replace(/^标题[:：]\s*/, '') // 去掉"标题:"前缀
      .replace(/^题目[:：]\s*/, '') // 去掉"题目:"前缀
      .replace(/^\d+[\.、]\s*/, '') // 去掉数字编号
      .trim();
  }
  
  // 验证标题合理性
  if (!extractedTitle || extractedTitle.length < 5 || extractedTitle.length > 30) {
    // 标题不合理，返回原内容不做分离
    return { title: null, content: cleanedResult };
  }
  
  // 提取正文内容
  const extractedContent = lines.slice(contentStartIndex).join('\n').trim();
  
  return {
    title: extractedTitle,
    content: extractedContent || cleanedResult // 如果没有有效正文，返回原内容
  };
};

/**
 * 解析 unified_translate_rewrite 任务的结构化输出
 * 期望格式：
 *   【标题】：...
 *   【正文】：
 *   ...
 *   ---
 *   【编导评审意见】：...（丢弃）
 */
const extractUnifiedResult = (aiResult) => {
  if (!aiResult || typeof aiResult !== 'string') {
    return { title: null, content: aiResult };
  }

  let raw = aiResult;

  // 移除 <think>...</think> 标签
  raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 提取标题
  // 提取标题 (更加宽容的正则)
  const titleMatch = raw.match(/(?:\*\*)?【标题】(?:\*\*)?[：:\s]*(.*)/);
  const title = titleMatch ? titleMatch[1].replace(/\*\*/g, '').trim() : null;

  // 提取正文（【正文】之后到 --- 或 【编导评审意见】之前）
  // 提取正文 (适配加粗和换行)
  const bodyMatch = raw.match(/(?:\*\*)?【正文】(?:\*\*)?[：:\s]*\n?([\s\S]*?)(?:\n---\n|\n【编导评审意见】|\n\*\*【编导评审意见】|$)/);
  let content = bodyMatch ? bodyMatch[1].trim() : null;

  // 若未匹配到结构，降级使用全文作为正文
  if (!title && !content) {
    return { title: null, content: raw };
  }

  return { title, content: content || raw };
};


/**
 * 智能重新生成标题
 */
const regenerateTitle = async (content, multiAI) => {
  if (!content || !multiAI) return null;
  
  try {
    console.log('    🔄 重新生成标题...');
    const result = await multiAI.processTask('custom_title_generate', content);
    if (result && result.trim()) {
      const newTitle = result.trim().split('\n')[0];
      console.log(`    ✅ 新标题: ${newTitle}`);
      return newTitle;
    }
    return null;
  } catch (error) {
    console.log(`    ❌ 标题生成失败: ${error.message}`);
    return null;
  }
};

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

  // 检测 AI 是否明确表示"无法分类"（内容不属于任何分类）
  // 若是则返回 null，发布端会以 draft 状态待人工审核
  const NO_CATEGORY_SIGNALS = ['无法分类', '不属于任何分类', '不适用', '无分类', '其他'];
  if (aiSelectedCategory && NO_CATEGORY_SIGNALS.some(sig => aiSelectedCategory.toLowerCase().includes(sig))) {
    console.log(`🚫 AI判断文章不属于任何分类: "${aiSelectedCategory}"`);
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

  // 如果仍然没有匹配，说明 AI 返回的分类不在已知分类列表中
  // 返回 null，发布端会以 draft 状态待人工审核（避免硬塞不合适的分类）
  if (!matchedCategory) {
    console.log(`⚠️  AI选择的分类"${aiSelectedCategory}"不在已知分类中，发布为 draft 待人工审核`);
    return null;
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
        case 'unified_translate_rewrite':
          // 统一翻译+重写：传入 {title, content} 对象以精确注入到模板占位符
          inputContent = { title: processedTitle, content: processedContent };
          break;
        case 'translate':
          // 翻译整个内容（包括标题），然后智能提取
          inputContent = `${processedTitle}\n\n${processedContent}`;
          break;
        case 'rewrite':
          // 重写整个内容（包括标题），然后智能提取
          inputContent = `${processedTitle}\n\n${processedContent}`;
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
      
      // 解析 unified_translate_rewrite 输出
            // 解析 unified_translate_rewrite 输出 (严格单次调用)
      if (task === 'unified_translate_rewrite') {
        const { title: uTitle, content: uContent } = extractUnifiedResult(result);
        if (uTitle) {
          console.log(`     📝 [统一处理] 解析获得标题: ${uTitle}`);
          processedTitle = uTitle;
        }
        if (uContent) {
          processedContent = uContent;
        }
      }

      // 智能处理translate和rewrite的结果
      if (task === 'translate' || task === 'rewrite') {
        const { title: extractedTitle, content: extractedContent } = extractTitleAndContent(result);
        
        if (extractedTitle) {
          console.log(`     📝 从${getTaskName(task)}结果中提取标题: ${extractedTitle}`);
          
          // 检查标题质量
          const qualityCheck = evaluateTitleQuality(extractedTitle, extractedContent);
          console.log(`     🔍 标题质量评估: ${qualityCheck.score}分 ${qualityCheck.isGood ? '✅' : '⚠️'}`);
          
          if (qualityCheck.issues.length > 0) {
            console.log(`     ⚠️ 标题问题: ${qualityCheck.issues.join(', ')}`);
          }
          
          // 如果标题质量极差，尝试重新生成
          let finalTitle = extractedTitle;
          if (qualityCheck.needsRegeneration) {
            const regeneratedTitle = await regenerateTitle(extractedContent, multiAIManager);
            if (regeneratedTitle) {
              finalTitle = regeneratedTitle;
              const newQualityCheck = evaluateTitleQuality(finalTitle, extractedContent);
              console.log(`     🔄 重新生成后质量: ${newQualityCheck.score}分 ${newQualityCheck.isGood ? '✅' : '⚠️'}`);
            }
          }
          
          // 任务优先级：rewrite > translate
          const shouldReplaceTitle = task === 'rewrite' || !processedTitle || processedTitle === originalContent.title;
          
          if (shouldReplaceTitle) {
            processedTitle = finalTitle;
            console.log(`     ✅ 更新标题: ${processedTitle} (${task === 'rewrite' ? '重写优先' : '首次提取'})`);
          } else {
            // 比较质量，如果新标题明显更好，则替换
            const currentQuality = evaluateTitleQuality(processedTitle, extractedContent);
            const newQuality = evaluateTitleQuality(finalTitle, extractedContent);
            
            if (newQuality.score > currentQuality.score + 20) {
              processedTitle = finalTitle;
              console.log(`     ✅ 替换标题: ${processedTitle} (质量提升${newQuality.score - currentQuality.score}分)`);
            } else {
              console.log(`     ➡️ 保留现有标题: ${processedTitle}`);
            }
          }
        }
        
        // 更新内容
        processedContent = extractedContent || result;
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
  
  // 最终标题质量检查
  const finalQualityCheck = evaluateTitleQuality(processedTitle, processedContent);
  console.log(`   🎯 最终标题质量: ${finalQualityCheck.score}分 ${finalQualityCheck.isGood ? '✅ 优质' : '⚠️ 需优化'}`);
  
  if (!finalQualityCheck.isGood) {
    console.log(`   ⚠️ 最终标题质量问题: ${finalQualityCheck.issues.join(', ')}`);
    
    // 如果最终标题质量仍然不佳，尝试最后一次重新生成
    if (finalQualityCheck.needsRegeneration && !tasks.includes('unified_translate_rewrite')) {
      console.log(`   🔄 执行最终标题优化...`);
      const finalRegeneratedTitle = await regenerateTitle(processedContent, multiAIManager);
      if (finalRegeneratedTitle) {
        const finalCheck = evaluateTitleQuality(finalRegeneratedTitle, processedContent);
        if (finalCheck.score > finalQualityCheck.score) {
          processedTitle = finalRegeneratedTitle;
          console.log(`   ✅ 最终标题优化成功: ${processedTitle} (质量提升至${finalCheck.score}分)`);
        }
      }
    }
  }
  
  console.log(`   ✅ AI处理完成，最终标题: "${processedTitle}"`);
  
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

/**
 * 批处理翻译：一次 AI 调用翻译所有文章
 * @param {MultiAIManager} multiAIManager - AI管理器
 * @param {Array} articles - 文章数组 [{url, title, content}]
 * @returns {Array} 翻译结果 [{url, translatedTitle, translatedContent}]
 */
/**
 * 按字符总量分批文章，确保每批输出不会超过 max_tokens 限制
 * @param {Array} articles - 文章数组
 * @param {number} maxCharsPerBatch - 每批累计最大字符数（默认12000，输出约12000 tokens）
 * @param {Function} getContent - 获取用于计量长度的内容
 * @param {number} maxArticlesPerBatch - 每批最多文章数。若一批塞入太多篇，单次AI输出的
 *   max_tokens 预算会被各篇瓜分，导致每篇内容被逐篇压缩（如19篇/批时每篇只剩几百字）。
 *   设为 4 保证每篇能获得完整输出预算。
 * @returns {Array} 分批后的数组
 */
/**
 * 健壮地解析 AI 返回的 { results: [...] } JSON。
 * 长译文常含未转义的换行/引号导致 JSON.parse 抛错，此时逐条正则提取每个字段。
 * 支持格式示例：
 *   {"results":[{"url":"...","translatedTitle":"...","translatedContent":"...","category":"..."}]}
 * 返回数组；解析失败抛错。
 */
const parseAiResultsArray = (raw) => {
  if (!raw || typeof raw !== 'string') {
    throw new Error('AI 响应为空');
  }
  let text = raw.trim();
  // 去掉 ```json 代码围栏
  if (text.startsWith('```json')) {
    text = text.replace(/^```json\s*/, '').replace(/```\s*$/, '');
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\s*/, '').replace(/```\s*$/, '');
  }
  text = text.trim();

  // 尝试标准解析
  try {
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.results)) return parsed.results;
    throw new Error('缺少 results 数组');
  } catch (e) {
    // 标准解析失败 → 逐条宽松提取
    if (!/^\{[\s\S]*\}$/.test(text)) {
      throw new Error(`AI 响应不是 JSON 对象: ${e.message}`);
    }
    // 按顶层 "results": [ ... ] 切出数组区间
    const arrStart = text.indexOf('"results"');
    if (arrStart === -1) throw new Error('未找到 results 字段');
    const bracketStart = text.indexOf('[', arrStart);
    if (bracketStart === -1) throw new Error('results 后缺少数组');
    // 匹配配对的中括号（逐字符计数）
    let depth = 0, arrEnd = -1;
    for (let i = bracketStart; i < text.length; i++) {
      if (text[i] === '[') depth++;
      else if (text[i] === ']') { depth--; if (depth === 0) { arrEnd = i; break; } }
    }
    if (arrEnd === -1) throw new Error('results 数组未闭合');
    const arrBody = text.slice(bracketStart + 1, arrEnd);

    // 拆分成条目：从每个 { 开始（粗略），用配对花括号切分
    const entries = [];
    let i = 0;
    while (i < arrBody.length) {
      while (i < arrBody.length && arrBody[i] !== '{') i++;
      if (i >= arrBody.length) break;
      let d = 0, j = i;
      let inStr = false, esc = false;
      for (; j < arrBody.length; j++) {
        const ch = arrBody[j];
        if (inStr) {
          if (esc) esc = false;
          else if (ch === '\\') esc = true;
          else if (ch === '"') inStr = false;
        } else {
          if (ch === '"') inStr = true;
          else if (ch === '{') d++;
          else if (ch === '}') { d--; if (d === 0) break; }
        }
      }
      entries.push(arrBody.slice(i, j + 1));
      i = j + 1;
    }

    // 每条提取字段
    const results = [];
    for (const ent of entries) {
      const item = {};
      // 提取 "key": "value" —— value 可能含转义与未转义内容，做宽容匹配
      const fieldRe = /"(\w+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
      let m;
      while ((m = fieldRe.exec(ent)) !== null) {
        let val = m[2];
        // 反转义常见 JSON 转义
        val = val
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');
        // 清理行内剩余的反斜杠转义残留（如 \u 保留原样）
        if (!(item[m[1]] === undefined)) {
          item[m[1]] = val;
        } else {
          item[m[1]] = val;
        }
      }
      if (Object.keys(item).length > 0) results.push(item);
    }
    if (results.length === 0) throw new Error('宽松解析未能提取到任何条目');
    return results;
  }
};

const chunkArticlesBySize = (articles, getContent, maxCharsPerBatch = 12000, maxArticlesPerBatch = 4) => {
  const batches = [];
  let currentBatch = [];
  let currentSize = 0;

  for (const article of articles) {
    const size = (getContent(article) || '').length;
    // 两个条件任一达到即封批：超过字符总量 或 超过篇数上限
    if (currentBatch.length > 0 && (currentSize + size > maxCharsPerBatch || currentBatch.length >= maxArticlesPerBatch)) {
      batches.push(currentBatch);
      currentBatch = [];
      currentSize = 0;
    }
    currentBatch.push(article);
    currentSize += size;
  }
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }
  return batches;
};

const translateArticlesBatch = async (multiAIManager, articles, maxCharsPerBatch = 12000) => {
  // 逐篇纯文本翻译：qwen-long 对 JSON 字段输出会压缩到数百字，纯文本才能输出完整长文。
  // 每篇一次 AI 调用，输出"第一行标题 + 空行 + 完整译文正文"。
  console.log(`\n🌐 开始逐篇翻译 (${articles.length} 篇文章)...`);

  const allResults = [];
  const engine = multiAIManager.getAgentForTask('translate');

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const url = article.url;
    const title = article.title || '';
    const content = article.content || '';
    process.stdout.write(`   📄 翻译 ${i + 1}/${articles.length}: ${(title || url).substring(0, 45)}... `);

    // 空内容直接跳过
    if (!content || content.trim().length < 30) {
      console.log('⚠️ 原文过短，跳过');
      continue;
    }

    const prompt = `你是资深中文新闻编辑。请把下面的英文新闻完整翻译成中文。

**硬性要求：**
1. 必须完整翻译全文，不得概括、压缩、删减任何段落、句子或细节
2. 保留所有具体事实、数字、人名、地名、机构名、引语和原文提到的日期
3. 译文信息量必须与原文相当：原文约每 6 个英文字符对应 1 个中文字，译文总长度应接近原文字符数的 1/3 到 1/2（例如原文 6000 字符 → 译文应约 2000 中文字）
4. 用专业新闻中文，把原文零散的短句整合成通顺的自然段落（每段 3-6 句，约 80-160 字，全文约 8-15 段），不要一句一段
5. 译文中不得包含任何 "=====" "文章N" "URL:" "TITLE:" 之类的分隔标记或说明文字

**输出格式（严格遵循）：**
第一行：翻译后的中文新闻标题
第二行：空行
第三行起：完整的译文正文（整合成自然段落）

英文新闻：
${content}`;

    try {
      const response = await engine.processContent(prompt, 'custom');
      let text = (response || '').trim();
      // 移除可能的代码围栏或多余前后缀
      text = text.replace(/^```[\s\S]*?\n/, '').replace(/\n```\s*$/, '').trim();

      // 解析：第一行=标题，其后为正文
      const lines = text.split('\n');
      let translatedTitle = '';
      let bodyStart = 0;
      // 找第一个非空行作为标题
      for (let j = 0; j < lines.length; j++) {
        if (lines[j].trim()) {
          translatedTitle = lines[j].trim();
          bodyStart = j + 1;
          break;
        }
      }
      // 跳过标题后的空行
      while (bodyStart < lines.length && lines[bodyStart].trim() === '') bodyStart++;
      const translatedContent = lines.slice(bodyStart).join('\n').trim();

      // 校验：若正文过短或疑似模板残留，记录但不中断
      const strippedLen = translatedContent.replace(/[\s-----]/g, '').length;
      if (strippedLen < 80 || /文章 \d|原文URL|TITLE:|CONTENT:|【第\d+篇】/i.test((translatedContent || '').substring(0, 150))) {
        console.log(`⚠️ 翻译异常(长度${strippedLen}，疑似残留)，记录跳过`);
        continue;
      }

      allResults.push({ url, translatedTitle: translatedTitle || title, translatedContent });
      console.log(`✅ ${translatedContent.length}字`);
    } catch (error) {
      console.error(`❌ 翻译失败: ${error.message.split('\n')[0]}`);
    }
    // 避免请求过快
    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`   ✅ 翻译完成: ${allResults.length} 篇文章`);
  return allResults;
};

/**
 * 批处理重写+分类：一次 AI 调用完成所有文章的重写和分类
 * @param {MultiAIManager} multiAIManager - AI管理器
 * @param {Array} articles - 文章数组 [{url, translatedTitle, translatedContent, originalTitle}]
 * @returns {Array} 重写结果 [{url, rewrittenTitle, rewrittenContent, category}]
 */
const rewriteAndCategorizeBatch = async (multiAIManager, articles, maxCharsPerBatch = 12000) => {
  // 逐篇纯文本重写+分类：qwen-long 对 JSON 字段输出会压缩到数百字，纯文本才能输出完整长文。
  // 每篇两步：1) 纯文本润色输出完整正文(首行标题)；2) 单独短调用取分类。
  console.log(`\n✍️  开始逐篇重写+分类 (${articles.length} 篇文章)...`);

  const allResults = [];
  const engine = multiAIManager.getAgentForTask('rewrite');

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const url = article.url;
    const translatedTitle = article.translatedTitle || '';
    const translatedContent = article.translatedContent || '';
    process.stdout.write(`   ✍️ 重写 ${i + 1}/${articles.length}: ${(translatedTitle || url).substring(0, 45)}... `);

    if (!translatedContent || translatedContent.trim().length < 30) {
      console.log('⚠️ 译文为空，跳过');
      continue;
    }

    // ---- 第一步：纯文本润色 ----
    const polishPrompt = `你是资深中文新闻编辑。请对下面的中文新闻做专业的润色重写，使成稿可直接发布。

**硬性要求：**
1. 必须完整保留译文的全部内容和信息，不得删减、压缩、概括任何事实、数字、人名、引语
2. 优化语句通顺度与用词专业性（半官方媒体风格）
3. 重要：把零散的单句、短段**整合成连贯的自然报道段落**——同一主题相关内容合并成一段（每段 3-6 句，约 80-160 字），全文约 6-12 段，切忌一句一段
4. 可调整语序使逻辑顺畅（导语在前），但不得丢失信息
5. 译文中不得包含任何 "=====" "文章N" "URL:" 之类分隔标记或说明文字

**输出格式（严格遵循）：**
第一行：润色后的中文新闻标题
第二行：空行
第三行起：完整润色后的正文（整合成自然段落）

待润色的中文新闻：
${translatedContent}`;

    let rewrittenTitle = translatedTitle;
    let rewrittenContent = '';
    let polishedOk = false;
    try {
      const resp = await engine.processContent(polishPrompt, 'custom');
      let text = (resp || '').trim();
      text = text.replace(/^```[\s\S]*?\n/, '').replace(/\n```\s*$/, '').trim();
      const lines = text.split('\n');
      for (let j = 0; j < lines.length; j++) {
        if (lines[j].trim()) { rewrittenTitle = lines[j].trim(); break; }
      }
      let bodyStart = 0;
      while (bodyStart < lines.length && lines[bodyStart].trim() === '') bodyStart++;
      rewrittenContent = lines.slice(bodyStart).join('\n').trim();

      const strippedLen = rewrittenContent.replace(/[\s-----]/g, '').length;
      polishedOk = strippedLen >= 80 && !/文章 \d|原文URL|TITLE:|CONTENT:|【第\d+篇】/i.test(rewrittenContent.substring(0, 150));
      if (!polishedOk) {
        console.log(`⚠️ 润色异常(长度${strippedLen})，尝试直接采用译文`);
      }
    } catch (err) {
      console.log(`❌ 润色失败(${err.message.split('\n')[0]})，采用译文`);
    }

    // 若润色失败或过短，回退使用原译文作为正文（翻译已含段落整合）
    const finalContent = polishedOk ? rewrittenContent : translatedContent;
    if (!finalContent || finalContent.trim().length < 80) {
      console.log('⚠️ 正文为空，跳过');
      continue;
    }

    // ---- 第二步：单独分类 ----
    let category = '';
    const catPrompt = `你是中文新闻分类专家。根据下面新闻内容，从这些分类中选一个最合适的：中爱动态、时政要闻、财经商业、科技产业、社会民生、教育文化、移民法务、房产规划。
规则：涉及中国与爱尔兰关系/合作/华人社区→中爱动态；爱尔兰本地新闻按其主题选；纯中国/纯国际(与爱尔兰中国无关)或低价值碎片→无法分类。
只输出一个分类词，不要其他文字。

新闻标题：${rewrittenTitle}
新闻内容(前800字)：
${finalContent.substring(0, 800)}`;
    try {
      const catResp = await engine.processContent(catPrompt, 'custom');
      category = (catResp || '').trim().replace(/[【】\s]/g, '');
      // 规范化分类名
      const validCats = ['中爱动态', '时政要闻', '财经商业', '科技产业', '社会民生', '教育文化', '移民法务', '房产规划', '无法分类'];
      const matched = validCats.find(c => category.includes(c));
      category = matched || '';
    } catch (err) {
      console.log(`   ⚠️ 分类失败(${err.message.split('\n')[0]})`);
    }

    allResults.push({ url, rewrittenTitle, rewrittenContent: finalContent, category });
    console.log(`✅ ${finalContent.length}字${category ? ` [${category}]` : ''}`);
    // 避免请求过快
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`   ✅ 重写+分类完成: ${allResults.length} 篇文章`);
  return allResults;
};

/**
 * 从所有文章中选出编辑精选（1-5 篇）
 * @param {Object} multiAIManager - AI管理器
 * @param {Array} articles - 已处理的文章列表 [{url, rewrittenTitle, category, rewrittenContent}]
 * @returns {Array} 编辑精选文章的URL列表（最多5个）
 */
const selectEditorPicks = async (multiAIManager, articles) => {
  if (!articles || articles.length === 0) {
    console.log('   🟡 没有文章可选');
    return [];
  }

  // 准备输入：标题 + 分类 + 摘要（前200字）
  const inputArticles = articles.map(article => ({
    url: article.url,
    title: article.rewrittenTitle || '',
    category: article.category || '',
    summary: (article.rewrittenContent || '').substring(0, 200)
  }));

  const prompt = `你是一名资深新闻编辑。请从以下 ${articles.length} 篇文章中选出最值得作为"编辑精选"的文章。

**选择标准（必须同时满足）：**
1. 高新闻价值：时效性强、当天最重要、最吸引眼球
2. 适合推送给中国新闻网：中爱关系、爱尔兰重大政策、对中国读者有意义的爱尔兰新闻

**输出格式（严格遵循）：**
返回一个 JSON 对象：
\`\`\`json
{
  "editorPicks": ["url1", "url2", ...]
}
\`\`\`

**要求：**
- 必须选出 1-5 篇（根据当天新闻质量决定）
- 如果当天没有够格的文章，可以返回空数组 []
- 只输出 JSON，不要其他说明文字

文章列表：
\`\`\`json
${JSON.stringify(inputArticles, null, 2)}
\`\`\``;

  try {
    console.log(`   🤖 AI正在从 ${articles.length} 篇文章中选择编辑精选...`);
    const engine = multiAIManager.getAgentForTask('rewrite');
    const response = await engine.processContent(prompt, 'custom');

    // 解析 JSON
    let cleanResponse = response.trim();
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    const parsed = JSON.parse(cleanResponse);
    const editorPicks = parsed.editorPicks || [];

    // 限制最多5篇
    if (editorPicks.length > 5) {
      console.log(`   ⚠️  AI选择了${editorPicks.length}篇编辑精选，截断为5篇`);
      return editorPicks.slice(0, 5);
    }

    return editorPicks;
  } catch (error) {
    console.error(`   ❌ 选择编辑精选失败: ${error.message}`);
    return [];
  }
};

module.exports = {
  extractUnifiedResult,
  getTaskName,
  generateCategoryPrompt,
  validateAndGetCategoryId,
  enhanceContent,
  processNewsWithAI,
  processNewsWithDynamicCategories, // 新增的完整处理函数
  parseKeywords,
  getCategoryId,
  evaluateTitleQuality, // 新增：标题质量评估
  regenerateTitle, // 新增：标题重新生成
  extractTitleAndContent, // 新增：智能标题提取
  translateArticlesBatch, // 新增：批处理翻译
  rewriteAndCategorizeBatch, // 新增：批处理重写+分类
  selectEditorPicks // 新增：选择编辑精选
};
