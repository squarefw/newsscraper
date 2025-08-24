#!/usr/bin/env node

/**
 * Debug脚本 - 模拟 batch-ai-push-enhanced.js 的配置读取
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 模拟 batch-ai-push-enhanced.js 配置读取');
console.log('=============================================\n');

// 模拟命令行参数
const args = ['config/config.remote-230.json', 'examples/test-urls.txt'];
let configPath = args[0];

console.log(`📋 输入参数: ${args.join(' ')}`);

// 如果配置路径是相对路径，相对于项目根目录解析
if (!path.isAbsolute(configPath)) {
  configPath = path.resolve(__dirname, configPath);
}

console.log(`📁 解析后配置路径: ${configPath}`);
console.log(`📁 文件存在: ${fs.existsSync(configPath)}`);

// 动态加载配置文件 (模拟脚本中的 loadConfig 函数)
const loadConfig = (configPath) => {
  try {
    console.log(`📋 加载配置文件: ${configPath}`);
    if (!fs.existsSync(configPath)) {
      throw new Error(`配置文件不存在: ${configPath}`);
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log(`✅ 配置加载成功`);
    return config;
  } catch (error) {
    throw new Error(`配置文件加载失败: ${error.message}`);
  }
};

try {
  const config = loadConfig(configPath);
  
  // 模拟脚本中的推送模式检测
  const pushMode = config.wordpress?.enabled ? 'wordpress' : 'api';
  console.log(`📋 推送模式: ${pushMode.toUpperCase()}`);
  
  // 模拟脚本中的配置信息输出
  console.log('📋 配置信息:');
  console.log(`  AI引擎: ${config.ai.engine}`);  // 注意：这里用的是 engine 而不是 defaultEngine
  
  if (pushMode === 'wordpress') {
    console.log(`  WordPress地址: ${config.wordpress.baseUrl}`);
    console.log(`  WordPress用户: ${config.wordpress.username}`);
    console.log(`  默认状态: ${config.wordpress.defaultStatus || 'draft'}`);
  } else {
    console.log(`  API地址: ${config.api.baseUrl}`);
    console.log(`  API密钥: ${config.api.apiKey ? '***已配置***' : '❌ 未配置'}`);
  }
  console.log(`  处理任务: ${config.ai.tasks.join(', ')}`);
  
  // 检查多AI管理器配置
  console.log('\n🎯 AI分工配置:');
  console.log(`   默认引擎: ${config.ai.defaultEngine}`);
  console.log(`   可用引擎: ${Object.keys(config.ai.engines || {}).join(', ')}`);
  
  if (config.ai?.taskEngines) {
    console.log('   任务分配:');
    Object.entries(config.ai.taskEngines).forEach(([task, engine]) => {
      console.log(`     ${task} -> ${engine}`);
    });
  }
  
} catch (error) {
  console.error(`❌ 配置加载失败: ${error.message}`);
}
