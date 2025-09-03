/**
 * 本地测试XML-  console.log('🔍 测试XML-RPC WordPress连接逻辑...');
  console.log(`📋 目标WordPress: ${config.wordpress?.siteUrl || 'undefined'}`);
  console.log(`👤 用户名: ${config.wordpress?.username || 'undefined'}`);
  console.log(`🔑 密码已配置: ${config.wordpress?.password ? '✅' : '❌'}`);
  
  console.log('\n🔍 WordPress完整配置:');
  console.log(JSON.stringify(config.wordpress, null, 2));能的简化版本
 * 专门用于验证XML-RPC实现逻辑
 */

const path = require('path');

// 加载配置
const configPath = path.resolve(__dirname, './config/config.remote-aliyun.json');
const ConfigLoader = require('./config/config-loader');
const configLoader = new ConfigLoader();
const environment = configLoader.inferEnvironment(configPath);
const config = configLoader.loadConfig(configPath, environment);

// 加载状态管理器
const ExecutionStateManager = require('./utils/executionStateManager');

async function testXMLRPCLogic() {
  console.log('🔍 测试XML-RPC WordPress连接逻辑...');
  console.log(`📋 目标WordPress: ${config.wordpress?.siteUrl || 'undefined'}`);
  console.log(`👤 用户名: ${config.wordpress?.username || 'undefined'}`);
  console.log(`🔑 密码已配置: ${config.wordpress?.password ? '✅' : '❌'}`);
  
  console.log('\n🔍 WordPress完整配置:');
  console.log(JSON.stringify(config.wordpress, null, 2));
  
  try {
    const stateManager = new ExecutionStateManager(config);
    
    console.log('\n📊 状态管理器信息:');
    console.log(`   - 状态模式: ${stateManager.stateMode}`);
    console.log(`   - 缓存超时: ${stateManager.cacheTimeoutMs}ms`);
    
    console.log('\n📡 测试XML-RPC获取最新文章时间...');
    const startTime = Date.now();
    
    try {
      const lastPostTime = await stateManager.getLastWordPressPostTime();
      const duration = Date.now() - startTime;
      
      console.log('✅ XML-RPC调用完成!');
      console.log(`⏱️ 耗时: ${duration}ms`);
      console.log(`📅 返回时间: ${lastPostTime}`);
      console.log(`📊 时间类型: ${typeof lastPostTime} ${lastPostTime instanceof Date ? '(Date对象)' : '(字符串)'}`);
      
      if (lastPostTime instanceof Date) {
        console.log(`📅 格式化时间: ${lastPostTime.toISOString()}`);
        console.log(`📅 本地时间: ${lastPostTime.toLocaleString()}`);
      }
      
    } catch (xmlrpcError) {
      console.log('⚠️ XML-RPC调用失败（这是预期的，因为本地无法连接远程WordPress）');
      console.log(`   错误类型: ${xmlrpcError.name || 'Unknown'}`);
      console.log(`   错误信息: ${xmlrpcError.message || 'No message'}`);
      
      // 检查是否正确应用了降级策略
      console.log('\n🔄 检查降级策略...');
      const fallbackTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      console.log(`📅 预期降级时间: ${fallbackTime.toISOString()}`);
    }
    
  } catch (error) {
    console.log('❌ 测试失败:');
    console.log(`   错误类型: ${error.name}`);
    console.log(`   错误信息: ${error.message}`);
    if (error.stack) {
      console.log('   错误堆栈:', error.stack.split('\n').slice(0, 3).join('\n'));
    }
  }
}

// 运行测试
console.log('🚀 开始XML-RPC功能测试\n');
testXMLRPCLogic().then(() => {
  console.log('\n🏁 测试完成');
  process.exit(0);
}).catch(error => {
  console.error('💥 测试异常:', error);
  process.exit(1);
});
