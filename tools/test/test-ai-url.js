#!/usr/bin/env node

/**
 * NewsScraper AI功能URL测试脚本
 * 输入新闻网页URL，执行完整的AI处理流程，生成详细测试报告
 */

const { AIFactory } = require('../../dist/ai/factory');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const config = require('../../config/config.remote.json');

// 文本自动换行函数
const wrapText = (text, maxWidth = 120) => {
  if (!text || typeof text !== 'string') return text;
  
  const lines = text.split('\n');
  const wrappedLines = [];
  
  for (const line of lines) {
    if (line.length <= maxWidth) {
      wrappedLines.push(line);
    } else {
      // 按单词或标点符号分割，避免在单词中间换行
      const words = line.split(/(\s+|[，。！？；：、）】}》"'])/);
      let currentLine = '';
      
      for (const word of words) {
        if ((currentLine + word).length <= maxWidth) {
          currentLine += word;
        } else {
          if (currentLine.trim()) {
            wrappedLines.push(currentLine.trim());
          }
          currentLine = word;
        }
      }
      
      if (currentLine.trim()) {
        wrappedLines.push(currentLine.trim());
      }
    }
  }
  
  return wrappedLines.join('\n');
};

// 测试报告模板
const generateReport = (data) => {
  const timestamp = new Date().toLocaleString('zh-CN');
  return `# NewsScraper AI 功能测试报告

**测试时间**: ${timestamp}
**测试URL**: ${data.url}
**AI引擎**: ${data.engine}
**模型**: ${data.model}

---

## 📰 原始新闻内容

### 标题
\`\`\`
${wrapText(data.original.title)}
\`\`\`

### 正文
\`\`\`
${wrapText(data.original.content)}
\`\`\`

### 原文统计
- **标题长度**: ${data.original.title.length} 字符
- **正文长度**: ${data.original.content.length} 字符
- **总字数**: ${data.original.title.length + data.original.content.length} 字符

---

## 🤖 AI 处理结果

${data.aiResults.map((result, index) => `
### ${index + 1}. ${result.task.toUpperCase()} - ${getTaskName(result.task)}

**处理时间**: ${result.duration}ms
**状态**: ${result.success ? '✅ 成功' : '❌ 失败'}

${result.success ? `
**输入内容**:
\`\`\`
${wrapText(result.input)}
\`\`\`

**输出结果**:
\`\`\`
${wrapText(result.output)}
\`\`\`

**输出统计**:
- **长度**: ${result.output.length} 字符
- **与原文比例**: ${((result.output.length / result.input.length) * 100).toFixed(1)}%
` : `
**错误信息**: ${wrapText(result.error)}
`}
`).join('\n')}

---

## 📊 处理总结

### 性能统计
- **总处理时间**: ${data.summary.totalTime}ms
- **平均处理时间**: ${Math.round(data.summary.totalTime / data.summary.totalTasks)}ms/任务
- **成功率**: ${((data.summary.successCount / data.summary.totalTasks) * 100).toFixed(1)}%

### AI任务完成情况
${data.summary.taskStatus.map(task => `- **${task.name}**: ${task.status}`).join('\n')}

### 内容质量评估
- **翻译准确性**: ${data.summary.translationQuality || 'N/A'}
- **重写完整性**: ${data.summary.rewriteCompleteness || 'N/A'}
- **摘要简洁性**: ${data.summary.summaryQuality || 'N/A'}

---

## 🔍 详细分析

### 内容处理效果
${data.analysis || ''}

### 建议改进
${data.recommendations || ''}

---

**报告生成**: ${timestamp}
**脚本版本**: v1.0.0
`;
};

// 获取任务中文名称
const getTaskName = (task) => {
  const taskNames = {
    'translate': '翻译',
    'rewrite': '重写',
    'summarize': '摘要',
    'extract_keywords': '关键词提取',
    'categorize': '智能分类',
    'sentiment': '情感分析'
  };
  return taskNames[task] || task;
};

// 从URL提取新闻内容
const extractNewsFromUrl = async (url) => {
  console.log(`📡 正在访问: ${url}`);
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 30000
    });

    const $ = cheerio.load(response.data);
    let title = '';
    let content = '';

    // 尝试多种选择器提取标题
    const titleSelectors = [
      'h1',
      '[data-testid="headline"]',
      '.story-headline',
      '.article-headline',
      '.headline',
      'title'
    ];

    for (const selector of titleSelectors) {
      title = $(selector).first().text().trim();
      if (title && title.length > 10) break;
    }

    // 尝试多种选择器提取正文
    const contentSelectors = [
      '[data-component="text-block"]',
      '.story-body__inner',
      '.article-body',
      '.content',
      '.post-content',
      'article p',
      '.entry-content p',
      'main p'
    ];

    for (const selector of contentSelectors) {
      const paragraphs = $(selector);
      if (paragraphs.length > 0) {
        content = paragraphs.map((i, el) => $(el).text().trim()).get().join('\n\n');
        if (content.length > 100) break;
      }
    }

    // 如果没有找到合适的内容，尝试通用方法
    if (!content || content.length < 100) {
      content = $('p').map((i, el) => $(el).text().trim()).get()
        .filter(text => text.length > 20)
        .slice(0, 10)
        .join('\n\n');
    }

    // 清理内容
    title = title.replace(/\s+/g, ' ').trim();
    content = content.replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();

    if (!title || !content) {
      throw new Error('无法提取有效的新闻内容');
    }

    console.log(`✅ 提取成功:`);
    console.log(`   标题长度: ${title.length} 字符`);
    console.log(`   正文长度: ${content.length} 字符`);

    return { title, content };
  } catch (error) {
    throw new Error(`网页内容提取失败: ${error.message}`);
  }
};

// 执行AI任务
const executeAiTask = async (aiAgent, content, task) => {
  const startTime = Date.now();
  
  try {
    console.log(`⚙️  执行 ${task.toUpperCase()} - ${getTaskName(task)}`);
    const result = await aiAgent.processContent(content, task);
    const duration = Date.now() - startTime;
    
    console.log(`   ✅ 完成 (${duration}ms)`);
    console.log(`   输出长度: ${result.length} 字符`);
    
    return {
      task,
      input: content,
      output: result,
      duration,
      success: true
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`   ❌ 失败: ${error.message} (${duration}ms)`);
    
    return {
      task,
      input: content,
      output: '',
      duration,
      success: false,
      error: error.message
    };
  }
};

// 生成内容分析
const generateAnalysis = (original, aiResults) => {
  let analysis = '';
  
  // 分析翻译效果
  const translateResult = aiResults.find(r => r.task === 'translate' && r.success);
  if (translateResult) {
    analysis += `**翻译效果**: 原文${original.content.length}字符，翻译后${translateResult.output.length}字符，`;
    analysis += `长度比例${((translateResult.output.length / original.content.length) * 100).toFixed(1)}%\n\n`;
  }

  // 分析重写效果
  const rewriteResult = aiResults.find(r => r.task === 'rewrite' && r.success);
  if (rewriteResult) {
    const lengthRatio = (rewriteResult.output.length / rewriteResult.input.length) * 100;
    analysis += `**重写效果**: 输入${rewriteResult.input.length}字符，重写后${rewriteResult.output.length}字符，`;
    analysis += `保持了${lengthRatio.toFixed(1)}%的长度`;
    if (lengthRatio >= 80) {
      analysis += ' ✅ 符合要求\n\n';
    } else {
      analysis += ' ⚠️ 长度不足\n\n';
    }
  }

  // 分析摘要效果
  const summaryResult = aiResults.find(r => r.task === 'summarize' && r.success);
  if (summaryResult) {
    analysis += `**摘要效果**: 原文${summaryResult.input.length}字符，摘要${summaryResult.output.length}字符，`;
    analysis += `压缩比${(100 - (summaryResult.output.length / summaryResult.input.length) * 100).toFixed(1)}%\n\n`;
  }

  return analysis;
};

// 主函数
async function main() {
  console.log('🤖 NewsScraper AI URL 测试脚本');
  console.log('=====================================\n');

  // 获取URL输入
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const url = await new Promise((resolve) => {
    rl.question('请输入新闻网页URL: ', (answer) => {
      resolve(answer.trim());
    });
  });

  rl.close();

  if (!url) {
    console.log('❌ 未提供URL');
    process.exit(1);
  }

  console.log(`\n🎯 目标URL: ${url}\n`);

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
      throw new Error('AI功能未启用，请在配置文件中设置 "enabled": true');
    }

    // 创建AI代理
    console.log('🚀 创建AI代理...');
    const aiAgent = AIFactory.getAgent(config);
    if (!aiAgent) {
      throw new Error('AI代理创建失败');
    }
    console.log('✅ AI代理创建成功\n');

    // 提取新闻内容
    const originalContent = await extractNewsFromUrl(url);
    console.log();

    // 准备测试报告数据
    const reportData = {
      url,
      engine: config.ai.engine,
      model: config.ai.ollama?.model || config.ai.openai?.model || 'unknown',
      original: originalContent,
      aiResults: [],
      summary: {
        totalTime: 0,
        totalTasks: 0,
        successCount: 0,
        taskStatus: []
      }
    };

    // 执行AI任务
    console.log('🤖 开始AI处理流程...\n');

    const testTasks = config.ai.tasks.filter(task => 
      ['translate', 'rewrite', 'summarize', 'extract_keywords', 'categorize', 'sentiment'].includes(task)
    );

    let processedTitle = originalContent.title;
    let processedContent = originalContent.content;

    for (const task of testTasks) {
      let inputContent;
      
      // 根据任务选择输入内容
      switch (task) {
        case 'translate':
          inputContent = processedContent;
          break;
        case 'rewrite':
          inputContent = processedContent;
          break;
        case 'summarize':
          inputContent = processedContent;
          break;
        case 'extract_keywords':
          inputContent = processedContent;
          break;
        case 'categorize':
          inputContent = processedContent;
          break;
        case 'sentiment':
          inputContent = processedContent;
          break;
        default:
          inputContent = processedContent;
      }

      const result = await executeAiTask(aiAgent, inputContent, task);
      reportData.aiResults.push(result);
      
      // 更新处理后的内容用于下一个任务
      if (result.success) {
        if (task === 'translate') {
          processedContent = result.output;
        } else if (task === 'rewrite') {
          processedContent = result.output;
        }
      }

      reportData.summary.totalTime += result.duration;
      reportData.summary.totalTasks++;
      if (result.success) reportData.summary.successCount++;
      
      reportData.summary.taskStatus.push({
        name: getTaskName(task),
        status: result.success ? '✅ 成功' : '❌ 失败'
      });
    }

    // 生成分析
    reportData.analysis = generateAnalysis(originalContent, reportData.aiResults);
    
    // 生成建议
    reportData.recommendations = '基于处理结果，建议关注重写任务的内容完整性和摘要的信息提取准确性。';

    // 生成测试报告
    const reportContent = generateReport(reportData);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const reportFilename = `ai-test-report-${timestamp}.md`;
    const reportPath = path.join(__dirname, '../reports', reportFilename);

    // 确保reports目录存在
    const reportsDir = path.join(__dirname, '../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // 保存报告
    fs.writeFileSync(reportPath, reportContent, 'utf8');

    console.log('\n📊 测试完成！');
    console.log('=====================================');
    console.log(`✅ 总任务: ${reportData.summary.totalTasks}`);
    console.log(`✅ 成功: ${reportData.summary.successCount}`);
    console.log(`❌ 失败: ${reportData.summary.totalTasks - reportData.summary.successCount}`);
    console.log(`⏱️  总耗时: ${reportData.summary.totalTime}ms`);
    console.log(`📄 报告已保存: ${reportPath}`);
    console.log(`\n💡 可以查看详细报告: cat "${reportPath}"`);

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, extractNewsFromUrl, executeAiTask };
