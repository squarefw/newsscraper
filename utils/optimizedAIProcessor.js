/**
 * 优化的AI处理器 - 支持多种处理模式
 * 支持原版6任务、选择性合并4任务、完全优化3任务三种模式
 */

class OptimizedAIProcessor {
  constructor(multiAIManager, config) {
    this.aiManager = multiAIManager;
    this.config = config;
    this.cache = new Map(); // 简单缓存
    
    // 支持的处理模式
    this.processingModes = {
      'original': 'original',      // 6个独立任务
      'selective': 'selective',    // 4个任务 (关键词+情感分析合并)
      'optimized': 'optimized'     // 3个任务 (进一步合并分类+摘要)
    };
    
    // 默认使用选择性优化模式
    this.processingMode = config.ai?.processingMode || 'selective';
    console.log(`🎯 AI处理器模式: ${this.processingMode}`);
  }

  /**
   * 设置处理模式
   */
  setProcessingMode(mode) {
    if (this.processingModes[mode]) {
      this.processingMode = mode;
      console.log(`🔄 切换AI处理模式为: ${mode}`);
    } else {
      console.warn(`⚠️ 未知的处理模式: ${mode}，使用默认模式: selective`);
      this.processingMode = 'selective';
    }
  }

  /**
   * 根据模式选择处理方法
   */
  async processContentOptimized(originalTitle, originalContent, categories) {
    console.log(`🚀 开始AI处理流程 (模式: ${this.processingMode})`);
    
    switch (this.processingMode) {
      case 'original':
        return await this.processOriginalMode(originalTitle, originalContent, categories);
      case 'selective':
        return await this.processSelectiveMode(originalTitle, originalContent, categories);
      case 'optimized':
        return await this.processOptimizedMode(originalTitle, originalContent, categories);
      default:
        console.warn(`未知处理模式: ${this.processingMode}，使用selective模式`);
        return await this.processSelectiveMode(originalTitle, originalContent, categories);
    }
  }

  /**
   * 原版模式：6个独立任务 (质量最高)
   */
  async processOriginalMode(originalTitle, originalContent, categories) {
    console.log('   使用优化的原版6任务模式 (串行优化)');
    
    const results = {};
    const fullContent = `${originalTitle}\n\n${originalContent}`;
    
    // 生成缓存键
    const cacheKey = this.generateCacheKey(fullContent + '_original_optimized');
    if (this.cache.has(cacheKey)) {
      console.log('   ✅ 使用缓存结果，跳过AI处理');
      return this.cache.get(cacheKey);
    }

    try {
      // 任务1: 翻译
      console.log('   1/4 执行 TRANSLATE - 翻译');
      const translateAgent = this.aiManager.getAgentForTask('translate');
      const translatePrompt = this.aiManager.getPromptForTask(originalContent, 'translate');
      const translateResult = await translateAgent.processContent(translatePrompt, 'translate');
      results.translation = translateResult.trim();

      // 任务2: 重写
      console.log('   2/4 执行 REWRITE - 重写');
      const rewriteAgent = this.aiManager.getAgentForTask('rewrite');
      const rewritePrompt = this.aiManager.getPromptForTask(results.translation, 'rewrite');
      const rewriteResult = await rewriteAgent.processContent(rewritePrompt, 'rewrite');
      results.rewritten = rewriteResult.trim();
      
      // 翻译质量检查
      if (!this.isValidTranslation(results.translation, originalContent)) {
        console.warn('   ⚠️  翻译质量不达标，可能影响后续任务');
      } else {
        console.log('   ✅ 翻译质量检查通过');
      }

      // 任务3: 使用重写后的中文稿生成摘要
      console.log('   3/4 执行 SUMMARIZE - 基于中文稿生成摘要');
      const summaryAgent = this.aiManager.getAgentForTask('summarize');
      // 使用重写后的内容作为输入
      const summaryPrompt = this.aiManager.getPromptForTask(results.rewritten, 'summarize');
      const summaryResult = await summaryAgent.processContent(summaryPrompt, 'summarize');
      results.summary = summaryResult.trim();

      // 任务4: 使用摘要执行轻量级分析任务
      console.log('   4/4 使用摘要执行轻量级分析 (关键词、情感、分类)');
      const analysisContent = results.summary; // 使用摘要进行分析

      // 4a: 关键词提取
      const keywordAgent = this.aiManager.getAgentForTask('extract_keywords');
      const keywordPrompt = this.aiManager.getPromptForTask(analysisContent, 'extract_keywords');
      const keywordResult = await keywordAgent.processContent(keywordPrompt, 'extract_keywords');
      results.keywords = keywordResult.trim();

      // 4b: 情感分析
      const sentimentAgent = this.aiManager.getAgentForTask('sentiment');
      const sentimentPrompt = this.aiManager.getPromptForTask(analysisContent, 'sentiment');
      const sentimentResult = await sentimentAgent.processContent(sentimentPrompt, 'sentiment');
      results.sentiment = sentimentResult.trim();

      // 4c: 分类
      const categoryAgent = this.aiManager.getAgentForTask('categorize');
      const categoryPrompt = this.aiManager.getPromptForTask(analysisContent, 'categorize');
      const categoryResult = await categoryAgent.processContent(categoryPrompt, 'categorize');
      results.category = categoryResult.trim();

      // 缓存结果
      this.cache.set(cacheKey, results);
      console.log('✅ AI处理完成 (优化的原版模式)');
      
      return results;

    } catch (error) {
      console.error('❌ AI处理失败 (优化的原版模式):', error.message);
      throw error;
    }
  }

  /**
   * 选择性优化模式：4个任务 (关键词+情感分析合并)
   */
  async processSelectiveMode(originalTitle, originalContent, categories) {
    console.log('   使用选择性优化4任务模式 (关键词+情感分析合并)');
    
    const results = {};
    const fullContent = `${originalTitle}\n\n${originalContent}`;
    
    // 生成缓存键
    const cacheKey = this.generateCacheKey(fullContent + '_selective');
    if (this.cache.has(cacheKey)) {
      console.log('   ✅ 使用缓存结果，跳过AI处理');
      return this.cache.get(cacheKey);
    }

    try {
      // 任务1: 翻译
      console.log('   1/4 执行 TRANSLATE - 翻译');
      const translateAgent = this.aiManager.getAgentForTask('translate');
      const translatePrompt = this.aiManager.getPromptForTask(originalContent, 'translate');
      const translateResult = await translateAgent.processContent(translatePrompt, 'translate');
      results.translation = translateResult.trim();

      // 任务2: 重写
      console.log('   2/4 执行 REWRITE - 重写');
      const rewriteAgent = this.aiManager.getAgentForTask('rewrite');
      const rewritePrompt = this.aiManager.getPromptForTask(results.translation, 'rewrite');
      const rewriteResult = await rewriteAgent.processContent(rewritePrompt, 'rewrite');
      results.rewritten = rewriteResult.trim();

      // 任务3: 合并任务 - 关键词+情感分析
      console.log('   3/4 执行 KEYWORDS+SENTIMENT - 关键词提取与情感分析');
      const analysisAgent = this.aiManager.getAgentForTask('extract_keywords'); // 使用关键词引擎
      const analysisPrompt = this.aiManager.getPromptForTask(originalContent, 'analyze_keywords_sentiment');
      const analysisResult = await analysisAgent.processContent(analysisPrompt, 'analyze_keywords_sentiment');
      
      // 解析合并结果
      const parsed = this.parseKeywordsSentimentResult(analysisResult);
      results.keywords = parsed.keywords;
      results.sentiment = parsed.sentiment;

      // 任务4: 分类和摘要 (保持独立，因为摘要较复杂)
      console.log('   4a/4 执行 CATEGORIZE - 智能分类');
      const categoryAgent = this.aiManager.getAgentForTask('categorize');
      const categoryPrompt = this.aiManager.getPromptForTask(originalContent, 'categorize');
      const categoryResult = await categoryAgent.processContent(categoryPrompt, 'categorize');
      results.category = categoryResult.trim();

      console.log('   4b/4 执行 SUMMARIZE - 生成摘要');
      const summaryAgent = this.aiManager.getAgentForTask('summarize');
      const summaryPrompt = this.aiManager.getPromptForTask(originalContent, 'summarize');
      const summaryResult = await summaryAgent.processContent(summaryPrompt, 'summarize');
      results.summary = summaryResult.trim();

      // 翻译质量检查
      if (!this.isValidTranslation(results.translation, originalContent)) {
        console.warn('   ⚠️  翻译质量不达标');
      } else {
        console.log('   ✅ 翻译质量检查通过');
      }

      // 缓存结果
      this.cache.set(cacheKey, results);
      console.log('✅ AI处理完成 (选择性优化4任务模式)');
      
      return results;

    } catch (error) {
      console.error('❌ AI处理失败 (选择性模式):', error.message);
      // 如果选择性模式失败，回退到原版模式
      console.log('🔄 回退到原版6任务模式');
      return await this.processOriginalMode(originalTitle, originalContent, categories);
    }
  }

  /**
   * 完全优化模式：3个任务 (最大合并)
   */
  async processOptimizedMode(originalTitle, originalContent, categories) {
    console.log('   使用完全优化3任务模式 (最大任务合并)');
    
    const results = {};
    const fullContent = `${originalTitle}\n\n${originalContent}`;
    
    // 生成缓存键
    const cacheKey = this.generateCacheKey(fullContent + '_optimized');
    if (this.cache.has(cacheKey)) {
      console.log('   ✅ 使用缓存结果，跳过AI处理');
      return this.cache.get(cacheKey);
    }

    try {
      // 任务1: 合并翻译+重写
      console.log('   1/3 执行 TRANSLATE+REWRITE - 翻译并重写');
      const translateAgent = this.aiManager.getAgentForTask('translate');
      const translatePrompt = this.aiManager.getPromptForTask(originalContent, 'translate_and_rewrite');
      const translateResult = await translateAgent.processContent(translatePrompt, 'translate_and_rewrite');
      results.translation = translateResult.trim();
      results.rewritten = translateResult.trim(); // 直接使用合并结果

      // 任务2: 合并关键词+情感分析
      console.log('   2/3 执行 KEYWORDS+SENTIMENT - 关键词提取与情感分析');
      const analysisAgent = this.aiManager.getAgentForTask('extract_keywords');
      const analysisPrompt = this.aiManager.getPromptForTask(originalContent, 'analyze_keywords_sentiment');
      const analysisResult = await analysisAgent.processContent(analysisPrompt, 'analyze_keywords_sentiment');
      
      // 解析合并结果
      const parsed = this.parseKeywordsSentimentResult(analysisResult);
      results.keywords = parsed.keywords;
      results.sentiment = parsed.sentiment;

      // 任务3: 合并分类+摘要
      console.log('   3/3 执行 CATEGORIZE+SUMMARY - 分类与摘要');
      const categoryAgent = this.aiManager.getAgentForTask('categorize');
      const categoryPrompt = this.aiManager.getPromptForTask(originalContent, 'analyze_category_summary');
      const categoryResult = await categoryAgent.processContent(categoryPrompt, 'analyze_category_summary');
      
      // 解析合并结果
      const parsedCategory = this.parseCategorySummaryResult(categoryResult);
      results.category = parsedCategory.category;
      results.summary = parsedCategory.summary;

      // 翻译质量检查
      if (!this.isValidTranslation(results.translation, originalContent)) {
        console.warn('   ⚠️  翻译质量不达标');
      } else {
        console.log('   ✅ 翻译质量检查通过');
      }

      // 缓存结果
      this.cache.set(cacheKey, results);
      console.log('✅ AI处理完成 (完全优化3任务模式)');
      
      return results;

    } catch (error) {
      console.error('❌ AI处理失败 (完全优化模式):', error.message);
      // 如果完全优化模式失败，回退到选择性模式
      console.log('🔄 回退到选择性优化模式');
      return await this.processSelectiveMode(originalTitle, originalContent, categories);
    }
  }

  /**
   * 解析关键词+情感分析合并结果
   */
  parseKeywordsSentimentResult(text) {
    try {
      console.log('   🔍 解析合并结果:', text.substring(0, 200) + '...');
      
      const lines = text.trim().split('\n');
      let keywords = '';
      let sentiment = '';
      
      // 首先尝试按标准格式解析
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.includes('关键词:') || trimmedLine.includes('关键词：')) {
          keywords = trimmedLine.split(/关键词[:：]/)[1]?.trim() || '';
        } else if (trimmedLine.includes('情感倾向:') || trimmedLine.includes('情感倾向：')) {
          sentiment = trimmedLine.split(/情感倾向[:：]/)[1]?.trim() || '';
        }
      }
      
      // 如果标准格式解析失败，尝试其他方法
      if (!keywords || !sentiment) {
        console.warn('   ⚠️  标准格式解析失败，尝试备用方法');
        
        // 备用方法1：寻找关键词列表模式
        const keywordPatterns = [
          /关键词[：:]\s*([^\\n]+)/,
          /Keywords?\s*[：:]\s*([^\\n]+)/i,
          /主要词汇[：:]\s*([^\\n]+)/
        ];
        
        const sentimentPatterns = [
          /情感[倾向态度][：:]\s*([^\\n]+)/,
          /Sentiment\s*[：:]\s*([^\\n]+)/i,
          /(正面|负面|中性|积极|消极|中立)/
        ];
        
        for (const pattern of keywordPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            keywords = match[1].trim();
            break;
          }
        }
        
        for (const pattern of sentimentPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            sentiment = match[1].trim();
            break;
          }
        }
        
        // 备用方法2：如果还是没有，从文本中智能提取
        if (!keywords) {
          // 尝试提取看起来像关键词的内容（逗号分隔的短语）
          const commaListMatch = text.match(/([\u4e00-\u9fa5\w\s]+(?:,\s*[\u4e00-\u9fa5\w\s]+){2,})/);
          if (commaListMatch) {
            keywords = commaListMatch[1].trim();
          }
        }
        
        if (!sentiment) {
          // 查找情感词
          if (text.includes('负面') || text.includes('消极') || text.includes('悲观')) {
            sentiment = '负面';
          } else if (text.includes('正面') || text.includes('积极') || text.includes('乐观')) {
            sentiment = '正面';
          } else {
            sentiment = '中性';
          }
        }
      }
      
      // 清理和验证结果
      if (keywords) {
        // 移除可能的标点和格式字符
        keywords = keywords.replace(/^[\[\(\{\"']+|[\]\)\}\"']+$/g, '').trim();
        // 限制长度，避免过长的输出
        if (keywords.length > 200) {
          keywords = keywords.substring(0, 200) + '...';
        }
      }
      
      if (sentiment) {
        // 规范化情感词
        sentiment = sentiment.replace(/^[\[\(\{\"']+|[\]\)\}\"']+$/g, '').trim();
        if (!['正面', '负面', '中性', '积极', '消极', '中立'].includes(sentiment)) {
          if (sentiment.includes('负') || sentiment.includes('消极')) {
            sentiment = '负面';
          } else if (sentiment.includes('正') || sentiment.includes('积极')) {
            sentiment = '正面';
          } else {
            sentiment = '中性';
          }
        }
      }
      
      // 最终回退
      keywords = keywords || '新闻, 事件, 报道';
      sentiment = sentiment || '中性';
      
      console.log(`   ✅ 解析结果 - 关键词: "${keywords}", 情感: "${sentiment}"`);
      
      return {
        keywords: keywords,
        sentiment: sentiment
      };
      
    } catch (error) {
      console.warn('   ⚠️  关键词+情感解析异常:', error.message);
      return {
        keywords: '新闻, 事件, 报道',
        sentiment: '中性'
      };
    }
  }

  /**
   * 解析分类+摘要合并结果
   */
  parseCategorySummaryResult(text) {
    try {
      const lines = text.trim().split('\n');
      let category = '';
      let summary = '';
      
      for (const line of lines) {
        if (line.includes('分类:') || line.includes('分类：')) {
          category = line.split(/分类[:：]/)[1]?.trim() || '';
        } else if (line.includes('摘要:') || line.includes('摘要：')) {
          summary = line.split(/摘要[:：]/)[1]?.trim() || '';
        }
      }
      
      // 如果解析失败，尝试从整个文本中提取
      if (!category || !summary) {
        console.warn('   ⚠️  分类+摘要解析失败，使用原始输出');
        const parts = text.split('\n').filter(part => part.trim());
        category = category || (parts[0] || '其他').trim();
        summary = summary || (parts.slice(1).join(' ') || text).trim();
      }
      
      return {
        category: category,
        summary: summary
      };
    } catch (error) {
      console.warn('   ⚠️  分类+摘要解析失败:', error.message);
      return {
        category: '其他',
        summary: text.trim()
      };
    }
  }

  /**
   * 翻译质量验证
   */
  isValidTranslation(translation, originalContent) {
    if (!translation || translation.trim().length === 0) {
      return false;
    }
    
    // 检查是否只是返回了原文
    if (translation.trim() === originalContent.trim()) {
      return false;
    }
    
    // 检查长度合理性 (翻译后应该有一定长度)
    if (translation.length < originalContent.length * 0.3) {
      console.warn('   ⚠️  翻译长度过短，可能质量不佳');
      return false;
    }
    
    // 检查是否包含明显的英文内容（简单检查）
    const englishRatio = (translation.match(/[a-zA-Z]/g) || []).length / translation.length;
    if (englishRatio > 0.3) {
      console.warn('   ⚠️  翻译包含过多英文，可能翻译不完整');
      return false;
    }
    
    return true;
  }

  /**
   * 生成缓存键
   */
  generateCacheKey(content) {
    // 简单的哈希函数生成缓存键
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString();
  }

  /**
   * 获取优化统计信息
   */
  getOptimizationStats() {
    return {
      processingMode: this.processingMode,
      cacheSize: this.cache.size,
      availableModes: Object.keys(this.processingModes)
    };
  }
}

module.exports = { OptimizedAIProcessor };
