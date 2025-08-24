const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

// Import the AI manager from the parent project
const { MultiAIManager } = require('../../utils/multiAIManager');

const app = express();
const PORT = process.env.PORT || 3900;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Helper function to count words/characters correctly for mixed content
function countWords(text) {
  if (!text) return 0;
  
  // Clean text, remove extra whitespace
  const cleanText = text.trim().replace(/\s+/g, ' ');
  
  // Count Chinese characters, English words, and numbers separately
  const chineseChars = (cleanText.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (cleanText.match(/[a-zA-Z]+/g) || []).length;
  const numbers = (cleanText.match(/\d+/g) || []).length;
  
  // Return total count of meaningful characters/words
  return chineseChars + englishWords + numbers;
}

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Routes

// Get available AI engines and prompts
app.get('/api/config', async (req, res) => {
  try {
    // Read AI prompts configuration
    const promptsPath = path.join(__dirname, '../../config/ai-prompts.json');
    const configPath = path.join(__dirname, '../../config/config.remote-230.json');
    
    const prompts = JSON.parse(fs.readFileSync(promptsPath, 'utf8'));
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Extract available AI engines
    const aiEngines = [];
    if (config.ai?.engines) {
      Object.keys(config.ai.engines).forEach(engineName => {
        const engine = config.ai.engines[engineName];
        if (engine.enabled !== false) {
          aiEngines.push({
            id: engineName,
            name: engine.name || engineName,
            model: engine.model || 'default'
          });
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        aiEngines,
        prompts: {
          translate: prompts.tasks?.translate || {},
          rewrite: prompts.tasks?.rewrite || {}
        }
      }
    });
  } catch (error) {
    console.error('Error loading config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load configuration'
    });
  }
});

// Get default URL from quality-test-urls.txt
app.get('/api/default-url', (req, res) => {
  try {
    const urlsFilePath = path.join(__dirname, '../../examples/quality-test-urls.txt');
    
    if (!fs.existsSync(urlsFilePath)) {
      return res.json({
        success: true,
        data: { url: '' }
      });
    }
    
    const content = fs.readFileSync(urlsFilePath, 'utf8');
    const lines = content.split('\n');
    
    // 找到第一个不是注释且不为空的URL行
    let defaultUrl = '';
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#') && trimmedLine.startsWith('http')) {
        defaultUrl = trimmedLine;
        break;
      }
    }
    
    res.json({
      success: true,
      data: { url: defaultUrl }
    });
  } catch (error) {
    console.error('Error reading default URL:', error);
    res.json({
      success: true,
      data: { url: '' }
    });
  }
});

// Extract content from URL
app.post('/api/extract', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }
    
    console.log(`Extracting content from: ${url}`);
    
    // Fetch the webpage
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    // Parse HTML content
    const $ = cheerio.load(response.data);
    
    // Remove unwanted elements
    $('script, style, nav, header, footer, aside, .advertisement, .ads, .social-share').remove();
    
    // Extract title and content
    let title = $('title').text().trim() || 
                $('h1').first().text().trim() || 
                $('meta[property="og:title"]').attr('content') || 
                '';
    
    let content = '';
    
    // Try different content selectors
    const contentSelectors = [
      'article',
      '.content',
      '.post-content',
      '.entry-content',
      '.article-content',
      '.story-body',
      'main',
      '.main-content'
    ];
    
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length && element.text().trim().length > 200) {
        content = element.text().trim();
        break;
      }
    }
    
    // Fallback to body if no specific content found
    if (!content || content.length < 100) {
      content = $('body').text().trim();
    }
    
    // Clean up content
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
    
    // Limit content length
    if (content.length > 8000) {
      content = content.substring(0, 8000) + '...';
    }
    
    if (!title && !content) {
      throw new Error('No content could be extracted from the URL');
    }
    
    res.json({
      success: true,
      data: {
        url,
        title,
        content,
        wordCount: countWords(content)
      }
    });
    
  } catch (error) {
    console.error('Error extracting content:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to extract content from URL'
    });
  }
});

// Process content with AI
app.post('/api/process', async (req, res) => {
  try {
    const { 
      title, 
      content, 
      mode = 'both',
      translateEngine,
      rewriteEngine,
      translatePrompt, 
      rewritePrompt
    } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Title and content are required'
      });
    }
    
    // 根据模式验证必需的参数
    if ((mode === 'both' || mode === 'translate') && (!translateEngine || !translatePrompt)) {
      return res.status(400).json({
        success: false,
        error: 'Translate engine and prompt are required for translation'
      });
    }
    
    if ((mode === 'both' || mode === 'rewrite') && (!rewriteEngine || !rewritePrompt)) {
      return res.status(400).json({
        success: false,
        error: 'Rewrite engine and prompt are required for rewriting'
      });
    }
    
    console.log(`Processing with mode: ${mode}, translate engine: ${translateEngine}, rewrite engine: ${rewriteEngine}`);
    
    const startTime = Date.now();
    const results = {
      mode,
      translateEngine: translateEngine || null,
      rewriteEngine: rewriteEngine || null,
      timestamp: new Date().toISOString(),
      processing: {}
    };
    
    try {
      // 读取配置文件来初始化AI管理器
      const configPath = path.join(__dirname, '../../config/config.remote-230.json');
      const aiConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      // Initialize AI manager
      const aiManager = new MultiAIManager(aiConfig);
      await aiManager.initialize();
      
      // Process translation (if needed)
      if (mode === 'both' || mode === 'translate') {
        console.log('Starting translation...');
        const translateStart = Date.now();
        
        // 如果用户使用的是默认提示词模板，需要替换占位符
        let finalTranslatePrompt = translatePrompt;
        if (translatePrompt.includes('[新闻内容将在这里插入]')) {
          finalTranslatePrompt = translatePrompt.replace('[新闻内容将在这里插入]', content);
        } else if (translatePrompt.includes('{content}')) {
          finalTranslatePrompt = translatePrompt.replace('{content}', content);
        } else {
          // 如果是自定义提示词，直接在后面添加内容
          finalTranslatePrompt = translatePrompt + '\n\n' + content;
        }
        
        // 获取翻译引擎并处理
        const translateAgent = aiManager.getAgent(translateEngine);
        if (!translateAgent) {
          throw new Error(`Translation engine '${translateEngine}' not available`);
        }
        
        const translationResult = await translateAgent.processContent(finalTranslatePrompt, 'translate');
        
        results.processing.translate = {
          success: true,
          result: translationResult || '',
          timeMs: Date.now() - translateStart,
          wordCount: countWords(translationResult || '')
        };
        
        console.log(`Translation completed in ${results.processing.translate.timeMs}ms`);
      }
      
      // Process rewriting (if needed)
      if (mode === 'both' || mode === 'rewrite') {
        console.log('Starting rewrite...');
        const rewriteStart = Date.now();
        
        // 如果用户使用的是默认提示词模板，需要替换占位符
        let finalRewritePrompt = rewritePrompt;
        
        // 决定用于重写的内容：如果有翻译结果就用翻译结果，否则用原内容
        const contentToRewrite = (mode === 'both' && results.processing.translate) 
          ? results.processing.translate.result 
          : content;
        
        if (rewritePrompt.includes('[翻译后的内容将在这里插入]') || rewritePrompt.includes('[新闻内容将在这里插入]')) {
          finalRewritePrompt = rewritePrompt
            .replace('[翻译后的内容将在这里插入]', contentToRewrite)
            .replace('[新闻内容将在这里插入]', contentToRewrite);
        } else if (rewritePrompt.includes('{content}')) {
          finalRewritePrompt = rewritePrompt.replace('{content}', contentToRewrite);
        } else {
          // 如果是自定义提示词，直接在后面添加内容
          finalRewritePrompt = rewritePrompt + '\n\n' + contentToRewrite;
        }
        
        // 获取重写引擎并处理
        const rewriteAgent = aiManager.getAgent(rewriteEngine);
        if (!rewriteAgent) {
          throw new Error(`Rewrite engine '${rewriteEngine}' not available`);
        }
        
        const rewriteResult = await rewriteAgent.processContent(finalRewritePrompt, 'rewrite');
        
        results.processing.rewrite = {
          success: true,
          result: rewriteResult || '',
          timeMs: Date.now() - rewriteStart,
          wordCount: countWords(rewriteResult || '')
        };
        
        console.log(`Rewrite completed in ${results.processing.rewrite.timeMs}ms`);
      }
      
      // Calculate total time
      results.totalTimeMs = Date.now() - startTime;
      
      res.json({
        success: true,
        data: results
      });
      
    } catch (aiError) {
      console.error('AI processing error:', aiError);
      res.status(500).json({
        success: false,
        error: `AI processing failed: ${aiError.message}`
      });
    }
    
  } catch (error) {
    console.error('Error processing content:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process content'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Web Quality Tester server running on http://localhost:${PORT}`);
  console.log(`Access the interface at: http://localhost:${PORT}`);
});
