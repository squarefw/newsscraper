/**
 * 多AI管理器 (JavaScript版本)
 * 支持任务级AI分工合作
 */

// 导入各种AI引擎 - 使用CommonJS格式
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const axios = require('axios');

class MultiAIManager {
  constructor(config) {
    this.config = config;
    this.aiAgents = new Map();
    this.defaultEngine = config.ai.defaultEngine || 'github-models';
    this.fallbackStrategy = config.ai.fallbackStrategy || 'useDefault';
    this.initialized = false;
    this.prompts = null; // 将加载高质量prompt配置
  }

  /**
   * 初始化AI管理器
   */
  async initialize() {
    if (this.initialized) return;
    
    // 加载高质量prompt配置
    await this.loadPromptConfig();
    
    const engines = this.config.ai.engines;
    
    for (const [engineName, engineConfig] of Object.entries(engines)) {
      try {
        let agent;
        
        switch (engineName) {
          case 'github-models':
            agent = this.createGitHubModelsAgent(engineConfig);
            break;
            
          case 'gemini':
            agent = this.createGeminiAgent(engineConfig);
            break;
            
          case 'ollama':
            agent = this.createOllamaAgent(engineConfig);
            break;
            
          case 'siliconflow':
            agent = this.createSiliconFlowAgent(engineConfig);
            break;
            
          case 'openrouter':
            agent = this.createOpenRouterAgent(engineConfig);
            break;
            
          case 'qwen':
            agent = this.createQwenAgent(engineConfig);
            break;
            
          default:
            console.warn(`Unknown AI engine: ${engineName}`);
            continue;
        }
        
        if (agent && engineConfig.enabled !== false) {
          this.aiAgents.set(engineName, agent);
          console.log(`✅ Initialized AI engine: ${engineName}`);
        }
        
      } catch (error) {
        console.error(`❌ Failed to initialize ${engineName}:`, error.message);
      }
    }
    
    if (this.aiAgents.size === 0) {
      throw new Error('No AI engines were successfully initialized');
    }
    
    this.initialized = true;
    console.log(`🎯 MultiAI Manager initialized with ${this.aiAgents.size} engines`);
  }

  /**
   * 加载高质量prompt配置
   */
  async loadPromptConfig() {
    try {
      const fs = require('fs');
      const path = require('path');
      
      const promptConfigPath = path.join(__dirname, '../../config/ai-prompts.json');
      
      const promptConfigContent = fs.readFileSync(promptConfigPath, 'utf8');
      const promptConfig = JSON.parse(promptConfigContent);
      
      this.prompts = promptConfig.tasks;
      console.log('✅ 加载高质量prompt配置成功');
      
    } catch (error) {
      console.warn('⚠️ 无法加载prompt配置，使用默认prompt:', error.message);
      this.prompts = null;
    }
  }
  
  /**
   * 检查引擎是否被任务使用
   */
  isEngineUsed(engineName) {
    const taskEngines = this.config.ai.taskEngines;
    if (!taskEngines) return false;
    
    return Object.values(taskEngines).includes(engineName);
  }
  
  /**
   * 初始化单个AI引擎
   */
  initializeEngine(engineName, engineConfig) {
    try {
      let agent;
      
      switch (engineName) {
        case 'gemini':
          agent = this.createGeminiAgent(engineConfig);
          break;
        case 'openai':
          agent = this.createOpenAIAgent(engineConfig);
          break;
        case 'siliconflow':
          agent = this.createSiliconFlowAgent(engineConfig);
          break;
        case 'openrouter':
          agent = this.createOpenRouterAgent(engineConfig);
          break;
        case 'github':
          agent = this.createGitHubModelsAgent(engineConfig);
          break;
        case 'ollama':
          agent = this.createOllamaAgent(engineConfig);
          break;
        case 'qwen':
          agent = this.createQwenAgent(engineConfig);
          break;
        default:
          throw new Error(`Unsupported AI engine: ${engineName}`);
      }
      
      this.aiAgents.set(engineName, agent);
      console.log(`   ✅ AI engine '${engineName}' initialized successfully.`);
      
    } catch (error) {
      console.error(`   ❌ Failed to initialize AI engine '${engineName}': ${error.message}`);
      throw error;
    }
  }
  
  /**
   * 创建Gemini代理
   */
  createGeminiAgent(config) {
    if (!config.apiKey) {
      throw new Error('Gemini API Key is not configured.');
    }
    
    const genAI = new GoogleGenerativeAI(config.apiKey);
    const model = genAI.getGenerativeModel({ model: config.model || 'gemini-pro' });
    
    return {
      name: 'gemini',
      processContent: async (content, task) => {
        const prompt = this.getPromptForTask(content, task);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const rawText = response.text();
        return this.cleanAIOutput(rawText, task);
      }
    };
  }
  
  /**
   * 创建OpenAI代理
   */
  createOpenAIAgent(config) {
    if (!config.apiKey) {
      throw new Error('OpenAI API Key is not configured.');
    }
    
    const openai = new OpenAI({ apiKey: config.apiKey });
    
    return {
      name: 'openai',
      processContent: async (content, task) => {
        const prompt = this.getPromptForTask(content, task);
        const completion = await openai.chat.completions.create({
          model: config.model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: config.maxTokens || 4000,
          temperature: config.temperature || 0.3,
        });
        return completion.choices[0].message.content;
      }
    };
  }
  
  /**
   * 创建Qwen (Dashscope)代理
   */
  createQwenAgent(config) {
    if (!config.apiKey || !config.model) {
      throw new Error('Qwen (Dashscope) API Key or model is not configured.');
    }

    return {
      name: 'qwen',
      processContent: async (content, task) => {
        const prompt = this.getPromptForTask(content, task);
        const apiUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
        
        try {
          const response = await axios.post(apiUrl, {
            model: config.model,
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: config.temperature || 0.3,
            max_tokens: config.maxTokens || 8000
          }, {
            headers: {
              'Authorization': `Bearer ${config.apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: config.timeout || 180000
          });

          if (response.data.choices?.[0]?.message?.content) {
            const result = response.data.choices[0].message.content.trim();
            
            // 添加输出清理：移除可能的AI思考标签和多余内容
            const cleanResult = this.cleanAIOutput(result, task);
            return cleanResult;
          } else {
            console.error('Qwen API response error:', JSON.stringify(response.data, null, 2));
            throw new Error(`Invalid response structure from Qwen API: ${response.data.message || 'No content found'}`);
          }
        } catch (error) {
          console.error(`Error calling Qwen API: ${error.message}`);
          if (error.response) {
            console.error('Qwen API Error Response:', JSON.stringify(error.response.data, null, 2));
          }
          throw error;
        }
      }
    };
  }

  /**
   * 清理AI输出，移除思考标签和多余内容
   */
  cleanAIOutput(content, task = null) {
    if (task === 'unified_translate_rewrite') return content;
    if (!content || typeof content !== 'string') {
      return content;
    }
    
    let cleaned = content;
    
    // 移除<think>标签及其内容
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
    
    // 移除编辑说明和处理痕迹
    const editingPatterns = [
      /以下是对.*?的重写版本.*?：/gi,
      /以下是.*?重写.*?结果.*?：/gi,
      /根据.*?要求.*?重写.*?：/gi,
      /重写要求：[\s\S]*?$/gi,
      /附加要求：[\s\S]*?$/gi,
      /^.*?重写.*?版本.*?：/gim,
      /^.*?改写.*?结果.*?：/gim,
      /请.*?以下.*?内容/gi,
      /你是一名.*?编辑/gi,
      /^—+$/gm,  // 移除单独的破折号行
      /^以下是.*?翻译.*?：/gim,
      /^翻译结果.*?：/gim,
      /^改写结果.*?：/gim,
      /^重写结果.*?：/gim,
      /^新闻重写如下.*?：?/gim,
      /^新闻翻译如下.*?：?/gim,
      /^新闻内容如下.*?：?/gim,
      /^重写内容如下.*?：?/gim,
      /^翻译内容如下.*?：?/gim,
      /^以下是重写的.*?：?/gim,
      /^以下是翻译的.*?：?/gim,
      /^重写.*?：$/gim,
      /^翻译.*?：$/gim
    ];
    
    editingPatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    // 移除Markdown格式
    // 1. 移除标题标记 (e.g., ### Title -> Title)
    cleaned = cleaned.replace(/^(#+)\s*/gm, '');
    
    // 2. 移除粗体和斜体标记 (e.g., **text** -> text, *text* -> text)
    cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1');
    cleaned = cleaned.replace(/\*(.*?)\*/g, '$1');
    
    // 3. 移除无序列表标记 (e.g., - item -> item)
    cleaned = cleaned.replace(/^[\s]*[\-\*]\s+/gm, '');

    // 4. 移除引用标记
    cleaned = cleaned.replace(/^>\s*/gm, '');
    
    // 针对标题任务的特殊清理
    if (task && (task.includes('title') || task === 'custom_title_translate' || task === 'custom_title_generate')) {
      // 移除标题中的引号和多余符号
      cleaned = cleaned.replace(/^["'「」『』""'']*|["'「」『』""'']*$/g, '');
      // 移除标题中的冒号后缀
      cleaned = cleaned.replace(/[：:]\s*$/, '');
      // 确保标题长度合理（20字符以内）
      if (cleaned.length > 25) {
        cleaned = cleaned.substring(0, 22) + '...';
      }
    }
    
    // 移除多余的标点和分隔符
    cleaned = cleaned.replace(/^[—\-\*]+\s*$/gm, ''); // 移除分隔线
    cleaned = cleaned.replace(/^\s*[—\-]\s*$/gm, ''); // 移除单独的破折号
    
    // 清理多余的空行和空白
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
    
    // 移除开头和结尾的多余符号
    cleaned = cleaned.replace(/^[：:\-—\s]+/, '').replace(/[：:\-—\s]+$/, '');
    
    return cleaned;
  }
  
  /**
   * 创建SiliconFlow代理
   */
  createSiliconFlowAgent(config) {
    if (!config.apiKey || !config.model) {
      throw new Error('SiliconFlow API Key or model is not configured.');
    }
    
    return {
      name: 'siliconflow',
      processContent: async (content, task) => {
        const prompt = this.getPromptForTask(content, task);
        const apiUrl = config.baseUrl + '/v1/chat/completions';
        const response = await axios.post(apiUrl, {
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: config.maxTokens || 4000,
          temperature: config.temperature || 0.3,
        }, {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        return response.data.choices[0].message.content;
      }
    };
  }
  
  /**
   * 创建OpenRouter代理
   */
  createOpenRouterAgent(config) {
    if (!config.apiKey || !config.model) {
      throw new Error('OpenRouter API Key or model is not configured.');
    }
    
    return {
      name: 'openrouter',
      processContent: async (content, task) => {
        const prompt = this.getPromptForTask(content, task);
        const maxRetries = config.maxRetries || 2;
        const retryDelay = config.retryDelay || 5000;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const response = await axios.post(config.baseUrl + '/chat/completions', {
              model: config.model,
              messages: [{ role: 'user', content: prompt }],
              max_tokens: config.maxTokens || 2000,
              temperature: config.temperature || 0.3,
            }, {
              headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': config.referer || 'https://github.com/newsscraper',
                'X-Title': 'NewsScraper'
              },
              timeout: config.timeout || 45000
            });
            return response.data.choices[0].message.content;
          } catch (error) {
            if (error.response?.status === 429 && attempt < maxRetries) {
              console.log(`⚠️ OpenRouter rate limit hit, retrying in ${retryDelay}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              continue;
            }
            throw error;
          }
        }
      }
    };
  }
  
  /**
   * 创建Ollama代理
   */
  createOllamaAgent(config) {
    // 如果没有配置 baseUrl，抛出错误而不是使用默认值
    if (!config.baseUrl) {
      throw new Error('Ollama baseUrl is required in configuration');
    }
    const baseUrl = config.baseUrl;
    const model = config.model || 'llama2';
    
    return {
      name: 'ollama',
      processContent: async (content, task) => {
        const prompt = this.getPromptForTask(content, task);
        
        const response = await axios.post(`${baseUrl}/api/generate`, {
          model: model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.3,
            top_k: 40,
            top_p: 0.9,
          }
        }, {
          timeout: config.timeout || 600000
        });
        
        return response.data.response;
      }
    };
  }

  /**
   * 创建GitHub Models代理
   */
  createGitHubModelsAgent(config) {
    if (!config.apiKey) {
      throw new Error('GitHub Models API Key is not configured.');
    }
    
    // 如果没有配置 baseUrl，抛出错误而不是使用默认值
    if (!config.baseUrl) {
      throw new Error('GitHub Models baseUrl is required in configuration');
    }
    const baseUrl = config.baseUrl;
    const model = config.model || 'openai/gpt-4o-mini';
    const maxTokens = config.maxTokens || 4000;
    const temperature = config.temperature || 0.3;
    const timeout = config.timeout || 30000;
    
    return {
      name: 'github',
      processContent: async (content, task) => {
        const prompt = this.getPromptForTask(content, task);
        
        const requestBody = {
          model: model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: maxTokens,
          temperature: temperature,
          stream: false
        };

        const response = await axios.post(`${baseUrl}/inference/chat/completions`, requestBody, {
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${config.apiKey}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
            'User-Agent': 'NewsScraper/1.0'
          },
          timeout: timeout
        });

        if (!response.data.choices || response.data.choices.length === 0) {
          throw new Error('No choices in GitHub Models response');
        }

        const result = response.data.choices[0]?.message?.content?.trim();
        if (!result) {
          throw new Error('Empty response from GitHub Models');
        }

        return result;
      }
    };
  }

  /**
   * 兼容旧配置格式
   */
  getLegacyEngineConfig() {
    const ai = this.config.ai;
    const engines = {};
    
    // 提取所有引擎配置
    if (ai.ollama) engines.ollama = ai.ollama;
    if (ai.openai) engines.openai = ai.openai;
    if (ai.gemini) engines.gemini = ai.gemini;
    if (ai.siliconflow) engines.siliconflow = ai.siliconflow;
    if (ai.openrouter) engines.openrouter = ai.openrouter;
    if (ai.github) engines.github = ai.github;
    
    return engines;
  }
  
  /**
   * 根据任务获取最适合的AI代理
   */
  getAgentForTask(task) {
    const specifiedEngine = this.config.ai.taskEngines?.[task];
    const targetEngine = specifiedEngine || this.defaultEngine;
    
    console.log(`   🎯 Task '${task}' assigned to AI engine: ${targetEngine}`);
    
    return this.getAgent(targetEngine);
  }
  
  /**
   * 获取任务的引擎名称
   */
  getEngineNameForTask(task) {
    const specifiedEngine = this.config.ai.taskEngines?.[task];
    return specifiedEngine || this.defaultEngine;
  }
  
  /**
   * 获取指定的AI代理，带回退机制
   */
  getAgent(engineName) {
    // 尝试获取指定引擎
    if (this.aiAgents.has(engineName)) {
      return this.aiAgents.get(engineName);
    }
    
    // 尝试延迟初始化
    if (this.config.ai.engines?.[engineName]) {
      try {
        this.initializeEngine(engineName, this.config.ai.engines[engineName]);
        return this.aiAgents.get(engineName);
      } catch (error) {
        console.warn(`Failed to initialize AI engine '${engineName}': ${error.message}`);
      }
    }
    
    // 根据回退策略处理
    return this.handleFallback(engineName);
  }
  
  /**
   * 处理AI引擎回退逻辑
   */
  handleFallback(requestedEngine) {
    switch (this.fallbackStrategy) {
      case 'useDefault':
        if (requestedEngine !== this.defaultEngine && this.aiAgents.has(this.defaultEngine)) {
          console.warn(`⚠️  AI engine '${requestedEngine}' not available, falling back to default engine '${this.defaultEngine}'`);
          return this.aiAgents.get(this.defaultEngine);
        }
        break;
        
      case 'skipTask':
        console.warn(`⚠️  AI engine '${requestedEngine}' not available, task will be skipped`);
        throw new Error(`AI_ENGINE_SKIP: ${requestedEngine}`);
        
      case 'throwError':
        console.error(`❌ AI engine '${requestedEngine}' not available and no fallback allowed`);
        throw new Error(`AI engine '${requestedEngine}' is not available`);
        
      default:
        console.warn(`Unknown fallback strategy '${this.fallbackStrategy}', using default`);
        if (this.aiAgents.has(this.defaultEngine)) {
          return this.aiAgents.get(this.defaultEngine);
        }
    }
    
    throw new Error(`No available AI engines. Requested: '${requestedEngine}', Default: '${this.defaultEngine}'`);
  }
  
  /**
   * 获取任务对应的prompt
   */
  /**
   * 支持多占位符模板：传 {title, content} 对象可同时替换 {title} 和 {content}
   */
  getPromptForTask(contentOrParams, task) {
    // 优先使用加载的高质量prompt配置
    if (this.prompts && this.prompts[task] && this.prompts[task].template) {
      let template = this.prompts[task].template;
      // 支持 multi-placeholder 模板（{title} + {content}）
      if (typeof contentOrParams === 'object' && contentOrParams !== null && !Array.isArray(contentOrParams)) {
        const { title = '', content = '' } = contentOrParams;
        return template.replace('{title}', title).replace('{content}', content);
      }
      // 单占位符（向后兼容）
      return template.replace('{content}', contentOrParams);
    }
    
    // 如果没有加载到配置，使用简化版本作为后备
    const content = (typeof contentOrParams === 'object' && contentOrParams !== null) ? contentOrParams.content : contentOrParams;
    const fallbackPrompts = {
      translate: `请将以下英文新闻翻译成中文：\n\n${content}`,
      rewrite: `请重写以下新闻内容：\n\n${content}`,
      summarize: `请为以下新闻内容生成摘要：\n\n${content}`,
      extract_keywords: `请提取以下新闻内容的关键词：\n\n${content}`,
      categorize: `请为以下新闻内容选择分类：\n\n${content}`,
      sentiment: `请分析以下新闻内容的情感倾向：\n\n${content}`,
      custom_title_translate: `请根据以下新闻内容高度总结并生成一个适合新闻标题的中文标题，要求：\n1. 不超过20个中文字符\n2. 突出新闻核心要点和重点\n3. 使用适合新闻标题的简洁文笔\n4. 只输出标题，不要其他解释\n\n新闻内容：${content}`,
      custom_title_generate: `请为以下新闻内容写一个简洁明了的中文标题，要求：\n1. 不超过20个中文字符\n2. 突出新闻要点和核心内容\n3. 符合中文新闻标题习惯\n4. 只输出标题，不要其他解释\n\n新闻内容：${content}`,
    };
    
    return fallbackPrompts[task] || `请处理以下内容（任务类型：${task}）：\n\n${content}`;
  }
  
  /**
   * 获取可用的AI引擎列表
   */
  getAvailableEngines() {
    return Array.from(this.aiAgents.keys());
  }
  
  /**
   * 获取任务到AI引擎的映射
   */
  getTaskEngineMapping() {
    const mapping = {};
    const taskEngines = this.config.ai.taskEngines || {};
    
    for (const task of this.config.ai.tasks || []) {
      mapping[task] = taskEngines[task] || this.defaultEngine;
    }
    
    return mapping;
  }
  
  /**
   * 获取AI使用统计
   */
  getStats() {
    return {
      defaultEngine: this.defaultEngine,
      availableEngines: this.getAvailableEngines(),
      taskMapping: this.getTaskEngineMapping()
    };
  }
}

module.exports = { MultiAIManager };
