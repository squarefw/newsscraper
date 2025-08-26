/**
 * 执行状态管理器
 * 支持本地文件存储和WordPress时间戳两种模式
 * 用于实现增量抓取功能
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

class ExecutionStateManager {
  constructor(config) {
    this.config = config;
    this.stateFilePath = path.resolve(__dirname, '../temp/execution-state.json');
    this.wordpressCache = null;
    this.cacheExpiry = null;
    this.cacheTimeoutMs = 5 * 60 * 1000; // 5分钟缓存
    
    // 根据配置决定使用哪种状态管理模式
    this.stateMode = this.determineStateMode();
    console.log(`📋 状态管理模式: ${this.getStateModeDescription()}`);
  }

  /**
   * 确定状态管理模式
   */
  determineStateMode() {
    const executionConfig = this.config.execution;
    
    if (!executionConfig) {
      return 'file'; // 默认使用文件模式
    }
    
    const configMode = executionConfig.stateMode;
    
    if (configMode === 'wordpress') {
      return 'wordpress';
    } else if (configMode === 'file') {
      return 'file';
    } else if (configMode === 'auto') {
      // 自动检测环境
      return this.shouldUseWordPressMode() ? 'wordpress' : 'file';
    }
    
    return 'file'; // 默认
  }

  /**
   * 检测是否应该使用WordPress模式
   */
  shouldUseWordPressMode() {
    // 检测无服务器环境
    return process.env.FC_FUNC_CODE_PATH || // 阿里云函数计算
           process.env.AWS_LAMBDA_FUNCTION_NAME || // AWS Lambda
           process.env.VERCEL; // Vercel
  }

  /**
   * 获取状态模式描述
   */
  getStateModeDescription() {
    switch(this.stateMode) {
      case 'wordpress': return 'WordPress时间戳';
      case 'file': return '本地文件';
      default: return '未知模式';
    }
  }

  /**
   * 获取上次执行时间戳
   */
  async getLastExecutionTime() {
    if (this.stateMode === 'wordpress') {
      return await this.getLastWordPressPostTime();
    } else {
      return this.getLastExecutionTimeFromFile();
    }
  }

  /**
   * 从WordPress获取最新文章时间戳
   */
  async getLastWordPressPostTime() {
    try {
      // 检查缓存
      if (this.wordpressCache && this.cacheExpiry && Date.now() < this.cacheExpiry) {
        console.log('📋 使用缓存的WordPress最新文章时间');
        return this.wordpressCache;
      }

      console.log('📡 从WordPress获取最新文章时间...');
      
      const wordpress = this.config.wordpress;
      if (!wordpress || !wordpress.siteUrl) {
        throw new Error('WordPress配置不完整');
      }

      // 构建WordPress REST API URL
      const apiUrl = `${wordpress.siteUrl}/wp-json/wp/v2/posts?per_page=1&orderby=date&order=desc`;
      
      const response = await axios.get(apiUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'NewsScraperBot/1.0'
        }
      });

      if (response.data && response.data.length > 0) {
        const latestPost = response.data[0];
        const postTime = new Date(latestPost.date_gmt || latestPost.date);
        
        // 更新缓存
        this.wordpressCache = postTime;
        this.cacheExpiry = Date.now() + this.cacheTimeoutMs;
        
        console.log(`✅ WordPress最新文章时间: ${postTime.toISOString()}`);
        return postTime;
      } else {
        throw new Error('WordPress API返回空数据');
      }

    } catch (error) {
      console.log(`⚠️ WordPress REST API访问受限 (${error.response?.status || error.code}): ${error.message}`);
      console.log('💡 这是正常情况，将使用降级策略');
      
      // 降级策略：使用24小时前的时间戳
      const fallbackTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      console.log(`🔄 使用降级策略：24小时前 (${fallbackTime.toISOString()})`);
      
      // 缓存降级结果
      this.wordpressCache = fallbackTime;
      this.cacheExpiry = Date.now() + this.cacheTimeoutMs;
      
      return fallbackTime;
    }
  }

  /**
   * 从本地文件获取上次执行时间
   */
  getLastExecutionTimeFromFile() {
    try {
      if (!fs.existsSync(this.stateFilePath)) {
        // 如果状态文件不存在，返回24小时前的时间
        const defaultTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        console.log(`📋 状态文件不存在，使用默认时间: ${defaultTime.toISOString()}`);
        return defaultTime;
      }

      const stateData = JSON.parse(fs.readFileSync(this.stateFilePath, 'utf8'));
      const lastTime = new Date(stateData.lastExecutionTime);
      
      console.log(`📋 从文件加载上次执行时间: ${lastTime.toISOString()}`);
      return lastTime;
      
    } catch (error) {
      console.error(`❌ 读取状态文件失败: ${error.message}`);
      // 返回24小时前作为默认值
      const fallbackTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      console.log(`🔄 使用降级时间: ${fallbackTime.toISOString()}`);
      return fallbackTime;
    }
  }

  /**
   * 更新执行状态
   */
  async updateExecutionState(startTime = new Date()) {
    if (this.stateMode === 'wordpress') {
      // WordPress模式下不需要更新本地状态，WordPress本身会记录新文章时间
      console.log('📋 WordPress模式：状态自动更新（通过新文章发布）');
      return;
    } else {
      this.updateExecutionStateFile(startTime);
    }
  }

  /**
   * 更新本地状态文件
   */
  updateExecutionStateFile(startTime) {
    try {
      // 确保目录存在
      const tempDir = path.dirname(this.stateFilePath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // 读取现有状态或创建新状态
      let stateData = {
        lastExecutionTime: null,
        totalRuns: 0,
        totalDiscoveredUrls: 0,
        totalPushedArticles: 0,
        createdAt: new Date().toISOString()
      };

      if (fs.existsSync(this.stateFilePath)) {
        const existingData = JSON.parse(fs.readFileSync(this.stateFilePath, 'utf8'));
        stateData = { ...stateData, ...existingData };
      }

      // 更新状态
      stateData.lastExecutionTime = startTime.toISOString();
      stateData.totalRuns = (stateData.totalRuns || 0) + 1;
      stateData.lastUpdated = new Date().toISOString();

      // 写入文件
      fs.writeFileSync(this.stateFilePath, JSON.stringify(stateData, null, 2), 'utf8');
      console.log(`📋 状态文件已更新: ${this.stateFilePath}`);

    } catch (error) {
      console.error(`❌ 更新状态文件失败: ${error.message}`);
    }
  }

  /**
   * 获取执行状态摘要
   */
  async getExecutionSummary() {
    try {
      const lastTime = await this.getLastExecutionTime();
      const now = new Date();
      const minutesSinceLastRun = Math.floor((now - lastTime) / (1000 * 60));

      let runCount = 0;
      let totalUrls = 0;
      let totalArticles = 0;

      if (this.stateMode === 'file' && fs.existsSync(this.stateFilePath)) {
        const stateData = JSON.parse(fs.readFileSync(this.stateFilePath, 'utf8'));
        runCount = stateData.totalRuns || 0;
        totalUrls = stateData.totalDiscoveredUrls || 0;
        totalArticles = stateData.totalPushedArticles || 0;
      }

      return {
        stateMode: this.stateMode,
        lastExecutionTime: lastTime,
        minutesSinceLastRun,
        totalRuns: runCount,
        totalDiscoveredUrls: totalUrls,
        totalPushedArticles: totalArticles
      };

    } catch (error) {
      console.error(`❌ 获取执行摘要失败: ${error.message}`);
      return {
        stateMode: this.stateMode,
        error: error.message
      };
    }
  }

  /**
   * 检查文章是否应该被处理（基于时间过滤）
   */
  async shouldProcessArticle(articleDate, lastExecutionTime = null) {
    if (!lastExecutionTime) {
      lastExecutionTime = await this.getLastExecutionTime();
    }

    if (!articleDate) {
      // 如果文章没有日期信息，保守处理：保留
      return true;
    }

    // 确保是Date对象
    const articleTime = new Date(articleDate);
    const lastTime = new Date(lastExecutionTime);

    return articleTime > lastTime;
  }
}

module.exports = ExecutionStateManager;
