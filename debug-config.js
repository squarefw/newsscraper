#!/usr/bin/env node

/**
 * Debug脚本 - 检查配置文件读取情况
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 配置调试开始');
console.log('=====================================\n');

// 1. 检查配置文件路径
const configPath = path.resolve(__dirname, 'config/config.remote-230.json');
console.log(`📁 配置文件路径: ${configPath}`);
console.log(`📁 文件是否存在: ${fs.existsSync(configPath)}`);

// 2. 读取原始文件内容
console.log('\n📄 读取原始文件内容:');
try {
  const rawContent = fs.readFileSync(configPath, 'utf8');
  console.log(`   文件大小: ${rawContent.length} 字符`);
  console.log(`   前100字符: ${rawContent.substring(0, 100)}...`);
} catch (error) {
  console.error(`   ❌ 读取失败: ${error.message}`);
}

// 3. 解析JSON
console.log('\n🔧 解析JSON配置:');
try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  console.log('\n📋 WordPress配置:');
  console.log(`   enabled: ${config.wordpress?.enabled}`);
  console.log(`   baseUrl: "${config.wordpress?.baseUrl}"`);
  console.log(`   username: "${config.wordpress?.username}"`);
  console.log(`   password: "${config.wordpress?.password}"`);
  
  console.log('\n🤖 AI配置:');
  console.log(`   enabled: ${config.ai?.enabled}`);
  console.log(`   defaultEngine: "${config.ai?.defaultEngine}"`);
  console.log(`   可用引擎: ${Object.keys(config.ai?.engines || {}).join(', ')}`);
  
  console.log('\n🔑 AI引擎密钥检查:');
  if (config.ai?.engines) {
    Object.entries(config.ai.engines).forEach(([engine, settings]) => {
      const apiKey = settings.apiKey;
      if (apiKey) {
        const maskedKey = apiKey.length > 10 ? 
          `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}` : 
          apiKey.replace(/./g, '*');
        console.log(`   ${engine}: ${maskedKey} (${apiKey.length}字符)`);
      } else {
        console.log(`   ${engine}: ❌ 未设置`);
      }
    });
  }
  
  console.log('\n📋 任务引擎分配:');
  if (config.ai?.taskEngines) {
    Object.entries(config.ai.taskEngines).forEach(([task, engine]) => {
      console.log(`   ${task} -> ${engine}`);
    });
  }
  
} catch (error) {
  console.error(`   ❌ JSON解析失败: ${error.message}`);
}

// 4. 模拟脚本中的配置加载
console.log('\n🔄 模拟脚本配置加载:');
try {
  // 模拟 batch-ai-push-enhanced.js 中的配置加载方式
  const config = require('./config/config.remote-230.json');
  
  console.log('✅ require() 加载成功');
  console.log(`   WordPress URL: "${config.wordpress?.baseUrl}"`);
  console.log(`   AI默认引擎: "${config.ai?.defaultEngine}"`);
  
  // 检查URL有效性
  if (config.wordpress?.baseUrl) {
    const url = config.wordpress.baseUrl;
    if (url === 'YOUR_WORDPRESS_URL' || url.includes('YOUR_')) {
      console.log('   ⚠️  检测到占位符URL');
    } else {
      console.log('   ✅ URL格式正常');
    }
  }
  
} catch (error) {
  console.error(`   ❌ require()加载失败: ${error.message}`);
}

// 5. 测试WordPress连接
console.log('\n🌐 测试WordPress连接:');
const config = require('./config/config.remote-230.json');
if (config.wordpress?.baseUrl && config.wordpress.baseUrl !== 'YOUR_WORDPRESS_URL') {
  const axios = require('axios');
  const testUrl = `${config.wordpress.baseUrl}/wp-json/wp/v2/categories`;
  
  console.log(`   测试URL: ${testUrl}`);
  
  axios.get(testUrl, {
    timeout: 5000,
    auth: {
      username: config.wordpress.username,
      password: config.wordpress.password
    }
  }).then(response => {
    console.log(`   ✅ WordPress连接成功 (状态: ${response.status})`);
    console.log(`   📋 分类数量: ${response.data.length}`);
  }).catch(error => {
    console.log(`   ❌ WordPress连接失败: ${error.message}`);
    if (error.response) {
      console.log(`   状态码: ${error.response.status}`);
      console.log(`   错误信息: ${error.response.statusText}`);
    }
  });
} else {
  console.log('   ⚠️  跳过连接测试 (URL无效)');
}

console.log('\n🔍 配置调试结束');
