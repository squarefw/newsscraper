const PromptManager = require('../dist/promptManager').default;

// 测试统一prompt管理器
async function testPromptManager() {
  console.log('=== 测试统一Prompt管理器 ===\n');
  
  try {
    const promptManager = PromptManager.getInstance();
    
    // 测试获取可用任务
    console.log('1. 可用任务列表:');
    const tasks = promptManager.getAvailableTasks();
    console.log(tasks.join(', '));
    console.log('');
    
    // 测试各种任务的prompt
    const testContent = '这是一条测试新闻内容。';
    
    console.log('2. 测试各任务prompt:');
    for (const task of tasks) {
      console.log(`--- ${task} (${promptManager.getTaskDescription(task)}) ---`);
      try {
        const prompt = promptManager.getPrompt(task, testContent);
        console.log(prompt.substring(0, 100) + '...');
        console.log('');
      } catch (error) {
        console.error(`Error for task ${task}:`, error.message);
      }
    }
    
    // 测试无效任务
    console.log('3. 测试无效任务:');
    try {
      promptManager.getPrompt('invalid_task', testContent);
    } catch (error) {
      console.log('预期错误:', error.message);
    }
    
    console.log('\\n=== 测试完成 ===');
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

if (require.main === module) {
  testPromptManager();
}

module.exports = { testPromptManager };
