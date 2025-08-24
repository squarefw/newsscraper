#!/usr/bin/env node

/**
 * 测试新的API密钥配置系统
 */

const ConfigLoader = require('./config/config-loader');

console.log('🧪 测试API密钥配置系统');
console.log('================================\n');

try {
  const configLoader = new ConfigLoader();
  
  // 测试环境推断
  const env1 = configLoader.inferEnvironment('config/config.remote-230.json');
  const env2 = configLoader.inferEnvironment('config/config.remote-aliyun.json');
  
  console.log(`🎯 环境推断测试:`);
  console.log(`   config.remote-230.json -> ${env1}`);
  console.log(`   config.remote-aliyun.json -> ${env2}\n`);
  
  // 测试配置加载
  console.log(`📋 测试配置加载 (${env1}):`);
  const config = configLoader.loadConfig('config/config.remote-230.json', env1);
  
  console.log(`✅ 配置加载成功!`);
  console.log(`📊 配置验证:`);
  console.log(`   WordPress用户: ${config.wordpress.username}`);
  console.log(`   WordPress密码: ${config.wordpress.password ? '***已设置***' : '❌ 未设置'}`);
  console.log(`   默认AI引擎: ${config.ai.defaultEngine}`);
  
  // 检查AI引擎密钥
  console.log(`\n🤖 AI引擎密钥状态:`);
  Object.entries(config.ai.engines).forEach(([engine, engineConfig]) => {
    const hasKey = engineConfig.apiKey && engineConfig.apiKey !== 'FROM_API_KEYS_CONFIG';
    const keyPreview = hasKey ? engineConfig.apiKey.substring(0, 8) + '...' : '❌ 未设置';
    console.log(`   ${engine}: ${keyPreview}`);
  });
  
} catch (error) {
  console.error(`❌ 测试失败: ${error.message}`);
}
