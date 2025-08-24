#!/usr/bin/env node

/**
 * NewsScraper AI功能测试脚本
 * 用于验证AI引擎和各项任务是否正常工作
 */

const { AIFactory } = require('../../dist/ai/factory');
const config = require('../../config/config.remote.json');

// 测试用的示例内容
const testContent = {
  english: {
    title: "Ireland's Tech Sector Shows Strong Growth in Q3 2024",
    content: "Ireland's technology sector has demonstrated remarkable resilience and growth in the third quarter of 2024, with employment in the sector increasing by 12% compared to the same period last year. Major tech companies including Google, Facebook, and Apple have announced significant expansions of their Irish operations, citing the country's skilled workforce and favorable business environment. The Irish government has welcomed these developments, noting that the tech sector now accounts for over 15% of the country's GDP."
  }
};

async function testAIEngine() {
  console.log('🤖 NewsScraper AI功能测试');
  console.log('================================\n');

  try {
    // 检查AI配置
    console.log('📋 检查AI配置...');
    console.log(`  引擎: ${config.ai.engine}`);
    console.log(`  状态: ${config.ai.enabled ? '✅ 启用' : '❌ 禁用'}`);
    console.log(`  任务: ${config.ai.tasks.join(', ')}`);
    
    if (config.ai.engine === 'ollama') {
      console.log(`  模型: ${config.ai.ollama?.model}`);
      console.log(`  地址: ${config.ai.ollama?.baseUrl}`);
    }
    console.log();

    if (!config.ai.enabled) {
      console.log('❌ AI功能未启用，请在配置文件中设置 "enabled": true');
      return;
    }

    // 创建AI代理
    console.log('🚀 创建AI代理...');
    const aiAgent = AIFactory.getAgent(config);
    
    if (!aiAgent) {
      console.log('❌ AI代理创建失败');
      return;
    }
    console.log('✅ AI代理创建成功\n');

    // 健康检查
    if (typeof aiAgent.checkHealth === 'function') {
      console.log('🏥 执行健康检查...');
      const isHealthy = await aiAgent.checkHealth();
      console.log(`  状态: ${isHealthy ? '✅ 正常' : '❌ 异常'}\n`);
      
      if (!isHealthy) {
        console.log('⚠️  AI服务可能未启动或配置错误');
        if (config.ai.engine === 'ollama') {
          console.log('   请确保Ollama服务正在运行: ollama serve');
        }
        return;
      }
    }

    // 测试各项AI任务
    console.log('🧪 测试AI任务...\n');
    
    const testTasks = config.ai.tasks.filter(task => 
      ['translate', 'rewrite', 'summarize', 'extract_keywords', 'categorize', 'sentiment'].includes(task)
    );

    for (const task of testTasks) {
      console.log(`📝 测试任务: ${task}`);
      console.log(`   输入: "${testContent.english.title}"`);
      
      try {
        const startTime = Date.now();
        const result = await aiAgent.processContent(testContent.english.title, task);
        const duration = Date.now() - startTime;
        
        console.log(`   输出: "${result}"`);
        console.log(`   耗时: ${duration}ms`);
        console.log('   ✅ 成功\n');
      } catch (error) {
        console.log(`   ❌ 失败: ${error.message}\n`);
      }
    }

    // 完整流程测试
    console.log('🔄 测试完整AI处理流程...\n');
    
    let processedTitle = testContent.english.title;
    let processedContent = testContent.english.content;
    const results = {};
    
    for (const task of testTasks) {
      console.log(`⚙️  执行: ${task}`);
      
      try {
        const startTime = Date.now();
        
        switch (task) {
          case 'translate':
            processedTitle = await aiAgent.processContent(processedTitle, 'translate');
            processedContent = await aiAgent.processContent(processedContent, 'translate');
            results.title = processedTitle;
            results.content = processedContent;
            break;
          case 'rewrite':
            processedContent = await aiAgent.processContent(processedContent, 'rewrite');
            results.content = processedContent;
            break;
          case 'summarize':
            results.summary = await aiAgent.processContent(processedContent, 'summarize');
            break;
          case 'extract_keywords':
            results.keywords = await aiAgent.processContent(processedContent, 'extract_keywords');
            break;
          case 'categorize':
            results.category = await aiAgent.processContent(processedContent, 'categorize');
            break;
          case 'sentiment':
            results.sentiment = await aiAgent.processContent(processedContent, 'sentiment');
            break;
        }
        
        const duration = Date.now() - startTime;
        console.log(`   ✅ 完成 (${duration}ms)`);
      } catch (error) {
        console.log(`   ❌ 失败: ${error.message}`);
      }
    }
    
    // 显示最终结果
    console.log('\n📊 最终处理结果:');
    console.log('================================');
    
    if (results.title) {
      console.log(`📰 标题: ${results.title}`);
    }
    
    if (results.content) {
      console.log(`📄 内容: ${results.content.substring(0, 200)}${results.content.length > 200 ? '...' : ''}`);
    }
    
    if (results.summary) {
      console.log(`📝 摘要: ${results.summary}`);
    }
    
    if (results.keywords) {
      console.log(`🏷️  关键词: ${results.keywords}`);
    }
    
    if (results.category) {
      console.log(`📂 分类: ${results.category}`);
    }
    
    if (results.sentiment) {
      console.log(`❤️  情感: ${results.sentiment}`);
    }
    
    console.log('\n🎉 AI功能测试完成！');
    console.log('💡 现在可以运行 ./run-remote.sh 进行完整的新闻采集');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('详细错误:', error);
    
    // 提供故障排除建议
    console.log('\n🔧 故障排除建议:');
    if (config.ai.engine === 'ollama') {
      console.log('1. 确保Ollama服务正在运行: ollama serve');
      console.log('2. 检查模型是否已下载: ollama list');
      console.log(`3. 下载所需模型: ollama pull ${config.ai.ollama?.model}`);
    } else {
      console.log('1. 检查API密钥是否正确');
      console.log('2. 确认网络连接正常');
      console.log('3. 验证账户余额充足');
    }
    
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  testAIEngine();
}

module.exports = { testAIEngine };
