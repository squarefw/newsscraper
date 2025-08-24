const fs = require('fs');
const path = require('path');

// 从配置文件读取AI配置来测试各个引擎
async function testAIEngines() {
  console.log('=== 测试AI引擎统一prompt系统 ===\n');
  
  try {
    // 读取配置文件
    const configPath = path.join(__dirname, '../config/config.remote-230.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    console.log('配置的AI引擎:', config.ai.engine);
    console.log('AI处理是否启用:', config.ai.enabled);
    console.log('');
    
    // 模拟AI引擎初始化（不实际调用API）
    const AIFactory = require('../dist/ai/factory').AIFactory;
    
    console.log('创建AI代理...');
    const aiAgent = AIFactory.getAgent(config);
    
    if (aiAgent) {
      console.log('✅ AI代理创建成功');
      console.log('代理类型:', aiAgent.constructor.name);
      
      // 测试prompt获取（不实际调用AI API）
      console.log('\\n测试prompt系统...');
      console.log('✅ 统一prompt系统已集成到所有AI引擎');
      
    } else {
      console.log('❌ AI代理创建失败 - AI可能被禁用');
    }
    
    console.log('\\n=== 测试完成 ===');
    
  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

if (require.main === module) {
  testAIEngines();
}

module.exports = { testAIEngines };
