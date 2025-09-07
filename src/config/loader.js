const fs = require('fs');
const path = require('path');

/**
 * 配置加载器 - 自动合并API密钥到配置文件中
 * 支持从api-keys.local.json加载实际密钥，从api-keys.json加载模板
 */
class ConfigLoader {
  constructor() {
    // __dirname is src/config, we need to go to the project root's config directory
    this.configDir = path.resolve(__dirname, '../../config');
    this.apiKeysPath = path.join(this.configDir, 'api-keys.local.json');
    this.apiKeysTemplatePath = path.join(this.configDir, 'api-keys.json');
  }

  /**
   * 加载API密钥配置
   * @returns {Object} API密钥对象
   */
  loadApiKeys() {
    try {
      // 优先使用本地密钥文件
      if (fs.existsSync(this.apiKeysPath)) {
        const keys = JSON.parse(fs.readFileSync(this.apiKeysPath, 'utf8'));
        console.log('✅ 已加载本地API密钥配置');
        return keys;
      }
      
      // 如果本地文件不存在，使用模板文件
      if (fs.existsSync(this.apiKeysTemplatePath)) {
        const keys = JSON.parse(fs.readFileSync(this.apiKeysTemplatePath, 'utf8'));
        console.log('⚠️  使用模板API密钥配置，请复制api-keys.json为api-keys.local.json并填入真实密钥');
        return keys;
      }

      throw new Error('未找到API密钥配置文件');
    } catch (error) {
      console.error('❌ 加载API密钥失败:', error.message);
      return {};
    }
  }

  /**
   * 加载配置文件并自动注入API密钥
   * @param {string} configPath 配置文件路径
   * @param {string} environment 环境标识符 (如: remote-230, remote-aliyun)
   * @returns {Object} 合并后的配置对象
   */
  loadConfig(configPath, environment) {
    try {
      // 加载主配置文件
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const apiKeys = this.loadApiKeys();

      // 注入WordPress密钥
      if (config.wordpress && apiKeys.wordpress && apiKeys.wordpress[environment]) {
        const wpKeys = apiKeys.wordpress[environment];
        if (wpKeys.username) config.wordpress.username = wpKeys.username;
        if (wpKeys.password) config.wordpress.password = wpKeys.password;
      }

      // 注入API密钥
      if (config.api && apiKeys.api && apiKeys.api[environment]) {
        const apiKeyData = apiKeys.api[environment];
        if (apiKeyData.email) config.api.email = apiKeyData.email;
        if (apiKeyData.password) config.api.password = apiKeyData.password;
      }

      // 注入AI引擎密钥
      if (config.ai && config.ai.engines && apiKeys.ai) {
        Object.keys(config.ai.engines).forEach(engineName => {
          if (apiKeys.ai[engineName] && apiKeys.ai[engineName].apiKey) {
            config.ai.engines[engineName].apiKey = apiKeys.ai[engineName].apiKey;
          }
        });
      }

      console.log('✅ 配置文件加载完成，已注入API密钥');
      return config;

    } catch (error) {
      console.error('❌ 配置文件加载失败:', error.message);
      throw error;
    }
  }

  /**
   * 从配置文件路径推断环境标识符
   * @param {string} configPath 配置文件路径
   * @returns {string} 环境标识符
   */
  inferEnvironment(configPath) {
    const filename = path.basename(configPath, '.json');
    if (filename.includes('remote-230')) return 'remote-230';
    if (filename.includes('remote-aliyun')) return 'remote-aliyun';
    if (filename.includes('development')) return 'development';
    if (filename.includes('production')) return 'production';
    return 'default';
  }
}

module.exports = ConfigLoader;
