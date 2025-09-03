/**
 * 本地测试XML-RPC WordPress连接
 */

const path = require('path');

// 加载配置
const configPath = path.resolve(__dirname, './config/config.remote-aliyun.json');
const config = require(configPath);

// 加载状态管理器
const ExecutionStateManager = require('./utils/executionStateManager');

async function testXMLRPC() {
  console.log('🔍 测试XML-RPC WordPress连接...');
  console.log('📋 目标WordPress:', config.wordpress?.url || 'undefined');
  
  try {
    const stateManager = new ExecutionStateManager(config);
    
    console.log('\n📡 开始获取WordPress最新文章时间...');
    const lastPostTime = await stateManager.getLastWordPressPostTime();
    
    console.log('✅ XML-RPC测试成功!');
    console.log('📅 最新文章时间:', lastPostTime);
    console.log('📊 时间格式:', typeof lastPostTime, lastPostTime instanceof Date ? '(Date对象)' : '(字符串)');
    
  } catch (error) {
    console.log('❌ XML-RPC测试失败:');
    console.log('错误类型:', error.name);
    console.log('错误信息:', error.message);
    if (error.stack) {
      console.log('错误堆栈:', error.stack.split('\n').slice(0, 5).join('\n'));
    }
  }
}

// 运行测试
testXMLRPC().then(() => {
  console.log('\n🏁 测试完成');
  process.exit(0);
}).catch(error => {
  console.error('💥 测试异常:', error);
  process.exit(1);
});
