#!/usr/bin/env node

/**
 * AI处理模式对比测试工具
 * 测试同一篇新闻在original、selective、optimized三种模式下的表现
 */

const { MultiAIManager } = require('../../utils/multiAIManager');
const { OptimizedAIProcessor } = require('../../utils/optimizedAIProcessor');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// 获取命令行参数
const configPath = process.argv[2];
const testUrl = process.argv[3];

if (!configPath || !testUrl) {
  console.error('❌ 使用方法: node mode-comparison-test.js <config-file> <test-url>');
  console.error('💡 示例: node mode-comparison-test.js config/config.remote-230.json "https://www.bbc.com/news/articles/c2018wx3zlgo"');
  process.exit(1);
}

// 测试模式配置
const TEST_MODES = [
  { name: 'original', description: '原版6任务模式', expectedTasks: 6 },
  { name: 'selective', description: '选择性4任务模式', expectedTasks: 4 },
  { name: 'optimized', description: '完全优化3任务模式', expectedTasks: 3 }
];

// 成本估算配置 (基于常见AI服务定价)
const COST_CONFIG = {
  'github-models': { input: 0.0015, output: 0.002 }, // 每1K token (USD)
  'gemini': { input: 0.0015, output: 0.002 },
  'ollama': { input: 0.0, output: 0.0 } // 本地运行，成本为0
};

class ModeComparisonTester {
  constructor(config) {
    this.config = config;
    this.testResults = {};
    this.originalContent = null;
    this.originalTitle = null;
  }

  /**
   * 从URL提取新闻内容
   */
  async extractContentFromUrl(url) {
    console.log(`📡 正在获取新闻内容: ${url}`);
    
    try {
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      
      // 提取标题
      let title = $('h1').first().text().trim() || 
                  $('title').text().trim() || 
                  $('meta[property="og:title"]').attr('content') || '';

      // 提取正文内容
      let content = '';
      
      // 常见的新闻内容选择器
      const contentSelectors = [
        '[data-component="text-block"] p',
        '.story-body__inner p',
        '.article-body p',
        '.post-content p',
        '.entry-content p',
        'article p',
        '.content p',
        'main p'
      ];

      for (const selector of contentSelectors) {
        const paragraphs = $(selector);
        if (paragraphs.length > 0) {
          content = paragraphs.map((i, el) => $(el).text().trim()).get().join('\\n\\n');
          break;
        }
      }

      // 如果没有找到特定选择器，尝试通用方法
      if (!content) {
        content = $('p').map((i, el) => $(el).text().trim()).get()
          .filter(text => text.length > 50)
          .join('\\n\\n');
      }

      // 清理内容
      content = content.replace(/\\s+/g, ' ').replace(/\\n\\s*\\n/g, '\\n\\n').trim();
      
      // 限制长度以避免超时
      if (content.length > 5000) {
        content = content.substring(0, 5000);
        console.log('   ⚠️ 内容已截断至5000字符以避免超时');
      }

      console.log(`   ✅ 提取成功 - 标题: ${title.length}字符, 正文: ${content.length}字符`);
      
      return { title, content };

    } catch (error) {
      console.error(`❌ 内容提取失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 测试单个模式
   */
  async testMode(mode, aiManager, processor) {
    console.log(`\\n🧪 测试模式: ${mode.name} (${mode.description})`);
    console.log('='.repeat(60));
    
    const startTime = Date.now();
    let apiCallCount = 0;
    let tokenUsage = { input: 0, output: 0 };
    let errors = [];
    
    // 重置处理器模式
    processor.setProcessingMode(mode.name);
    
    try {
      // 创建API调用监控
      const originalProcessContent = aiManager.aiAgents.get('github')?.processContent || 
                                   aiManager.aiAgents.get('gemini')?.processContent ||
                                   aiManager.aiAgents.get('ollama')?.processContent;
      
      // 包装AI调用以统计
      this.wrapAIAgentsForMonitoring(aiManager, (tokens) => {
        apiCallCount++;
        tokenUsage.input += tokens.input || 0;
        tokenUsage.output += tokens.output || 0;
      });

      // 执行AI处理
      const result = await processor.processContentOptimized(
        this.originalTitle, 
        this.originalContent, 
        []
      );

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      // 计算成本
      const cost = this.calculateCost(tokenUsage, mode.name);

      // 记录结果
      this.testResults[mode.name] = {
        mode: mode.name,
        description: mode.description,
        success: true,
        duration: duration,
        apiCallCount: apiCallCount,
        expectedTasks: mode.expectedTasks,
        tokenUsage: tokenUsage,
        estimatedCost: cost,
        results: result,
        errors: errors,
        timestamp: new Date().toISOString()
      };

      console.log(`✅ ${mode.name}模式完成`);
      console.log(`   ⏱️ 耗时: ${duration.toFixed(2)}秒`);
      console.log(`   📊 API调用: ${apiCallCount}次`);
      console.log(`   🎯 Token使用: ${tokenUsage.input + tokenUsage.output}个`);
      console.log(`   💰 预估成本: $${cost.toFixed(6)}`);

    } catch (error) {
      console.error(`❌ ${mode.name}模式失败: ${error.message}`);
      
      this.testResults[mode.name] = {
        mode: mode.name,
        description: mode.description,
        success: false,
        duration: (Date.now() - startTime) / 1000,
        apiCallCount: apiCallCount,
        expectedTasks: mode.expectedTasks,
        tokenUsage: tokenUsage,
        estimatedCost: 0,
        results: null,
        errors: [error.message],
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 包装AI代理以监控调用
   */
  wrapAIAgentsForMonitoring(aiManager, onApiCall) {
    for (const [engineName, agent] of aiManager.aiAgents) {
      if (agent.processContent) {
        const originalMethod = agent.processContent.bind(agent);
        agent.processContent = async function(prompt, task) {
          // 估算token使用量
          const inputTokens = Math.ceil(prompt.length / 4); // 粗略估算
          const result = await originalMethod(prompt, task);
          const outputTokens = Math.ceil(result.length / 4); // 粗略估算
          
          onApiCall({
            engine: engineName,
            task: task,
            input: inputTokens,
            output: outputTokens
          });
          
          return result;
        };
      }
    }
  }

  /**
   * 计算预估成本
   */
  calculateCost(tokenUsage, mode) {
    // 简化的成本计算，实际应该根据具体引擎分别计算
    const avgInputCost = 0.0015; // 平均输入成本
    const avgOutputCost = 0.002; // 平均输出成本
    
    const inputCost = (tokenUsage.input / 1000) * avgInputCost;
    const outputCost = (tokenUsage.output / 1000) * avgOutputCost;
    
    return inputCost + outputCost;
  }

  /**
   * 生成详细对比报告
   */
  generateComparisonReport() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportsDir = path.join(__dirname, '../../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // --- 生成各模式的详细报告 ---
    for (const mode of TEST_MODES) {
      const result = this.testResults[mode.name];
      if (result && result.success) {
        const detailReportPath = `mode-comparison-${mode.name}-${timestamp}.md`;
        let detailReport = `# ${result.description} - 详细结果\\n\\n`;
        detailReport += `**测试时间**: ${new Date(result.timestamp).toLocaleString()}\\n`;
        detailReport += `**测试URL**: ${testUrl}\\n\\n`;
        detailReport += `## 性能指标\\n\\n`;
        detailReport += `- **处理时间**: ${result.duration.toFixed(2)}秒\\n`;
        detailReport += `- **API调用次数**: ${result.apiCallCount}次\\n`;
        detailReport += `- **Token使用**: 输入${result.tokenUsage.input}, 输出${result.tokenUsage.output} (总计 ${result.tokenUsage.input + result.tokenUsage.output})\\n`;
        detailReport += `- **预估成本**: $${result.estimatedCost.toFixed(6)}\\n\\n`;
        
        detailReport += `## AI输出结果\\n\\n`;
        if (result.results) {
          // 清理AI输出，移除<think>标签
          const cleanResults = this.cleanAIResults(result.results);
          
          detailReport += `### 翻译结果\\n\\n${cleanResults.translation || 'N/A'}\\n\\n`;
          detailReport += `### 重写结果\\n\\n${cleanResults.rewritten || 'N/A'}\\n\\n`;
          detailReport += `### 关键词\\n\\n\`${cleanResults.keywords || 'N/A'}\`\\n\\n`;
          detailReport += `### 情感倾向\\n\\n\`${cleanResults.sentiment || 'N/A'}\`\\n\\n`;
          detailReport += `### 分类\\n\\n\`${cleanResults.category || 'N/A'}\`\\n\\n`;
          detailReport += `### 摘要\\n\\n${cleanResults.summary || 'N/A'}\\n\\n`;
        }
        fs.writeFileSync(path.join(reportsDir, detailReportPath), detailReport);
        console.log(`   📄 ${mode.name} 模式详细报告已保存: reports/${detailReportPath}`);
      }
    }

    // --- 生成主摘要报告 ---
    const summaryReportPath = `mode-comparison-summary-${timestamp}.md`;
    let summaryReport = `# AI处理模式对比测试报告\\n\\n`;
    summaryReport += `**测试时间**: ${new Date().toLocaleString()}\\n`;
    summaryReport += `**测试URL**: ${testUrl}\\n\\n`;

    // 原文信息
    summaryReport += `## 📰 测试新闻内容\\n\\n`;
    summaryReport += `**标题**: ${this.originalTitle}\\n`;
    summaryReport += `**正文长度**: ${this.originalContent.length} 字符\\n`;
    summaryReport += `**正文预览**:\\n> ${this.originalContent.substring(0, 200).replace(/\\n/g, ' ')}...\\n\\n`;

    // 性能对比表格
    summaryReport += `## 📊 性能对比概览\\n\\n`;
    summaryReport += `| 模式 | 状态 | 耗时(秒) | API调用 | Token使用 | 预估成本 | 详细报告 |\\n`;
    summaryReport += `|------|------|----------|---------|-----------|----------|----------|\\n`;
    
    for (const mode of TEST_MODES) {
      const result = this.testResults[mode.name];
      if (result) {
        const status = result.success ? '✅' : '❌';
        const duration = result.duration.toFixed(2);
        const tokens = result.tokenUsage.input + result.tokenUsage.output;
        const cost = result.estimatedCost.toFixed(6);
        const detailReportLink = result.success ? `[查看详情](./mode-comparison-${mode.name}-${timestamp}.md)` : 'N/A';
        
        summaryReport += `| ${mode.description} | ${status} | ${duration} | ${result.apiCallCount} | ${tokens} | $${cost} | ${detailReportLink} |\\n`;
      }
    }

    // 性能分析
    summaryReport += `\\n## 📈 性能分析\\n\\n`;
    const successfulResults = Object.values(this.testResults).filter(r => r.success);
    if (successfulResults.length > 1) {
      const baseline = successfulResults.find(r => r.mode === 'original');
      if (baseline) {
        summaryReport += `**以原版模式为基准的改进幅度**:\\n\\n`;
        for (const result of successfulResults) {
          if (result.mode !== 'original') {
            const timeImprovement = ((baseline.duration - result.duration) / baseline.duration * 100).toFixed(1);
            const callReduction = ((baseline.apiCallCount - result.apiCallCount) / baseline.apiCallCount * 100).toFixed(1);
            const costSaving = ((baseline.estimatedCost - result.estimatedCost) / baseline.estimatedCost * 100).toFixed(1);
            
            summaryReport += `- **${result.description}**:\\n`;
            summaryReport += `  - **时间优化**: ${timeImprovement}%\\n`;
            summaryReport += `  - **API调用减少**: ${callReduction}%\\n`;
            summaryReport += `  - **成本节省**: ${costSaving}%\\n\\n`;
          }
        }
      }
    }

    // 质量评估
    summaryReport += `## 🎯 质量评估\\n\\n`;
    summaryReport += `基于输出内容的定性分析:\\n\\n`;
    for (const mode of TEST_MODES) {
      const result = this.testResults[mode.name];
      if (result && result.success) {
        summaryReport += `**${result.description}**:\\n`;
        const cleanResults = this.cleanAIResults(result.results);
        const hasValidTranslation = cleanResults.translation && cleanResults.translation.length > 100 && !/[a-zA-Z]/.test(cleanResults.summary);
        const hasValidKeywords = cleanResults.keywords && !cleanResults.keywords.includes('<think>');
        const hasValidSentiment = ['正面', '负面', '中性'].includes(cleanResults.sentiment);
        
        summaryReport += `- 翻译质量: ${hasValidTranslation ? '✅ 良好' : '⚠️ 需改进'}\\n`;
        summaryReport += `- 关键词提取: ${hasValidKeywords ? '✅ 正常' : '⚠️ 格式问题'}\\n`;
        summaryReport += `- 情感分析: ${hasValidSentiment ? '✅ 准确' : '⚠️ 需优化'}\\n\\n`;
      }
    }

    // 建议与总结
    summaryReport += `## 💡 建议与总结\\n\\n`;
    const bestPerformance = successfulResults.sort((a, b) => a.duration - b.duration)[0];
    const mostCostEffective = successfulResults.sort((a, b) => a.estimatedCost - b.estimatedCost)[0];
    
    if (bestPerformance) {
      summaryReport += `**性能最佳**: ${bestPerformance.description} (${bestPerformance.duration.toFixed(2)}秒)\\n`;
    }
    if (mostCostEffective) {
      summaryReport += `**成本最优**: ${mostCostEffective.description} ($${mostCostEffective.estimatedCost.toFixed(6)})\\n\\n`;
    }
    
    summaryReport += `**推荐使用场景**:\\n`;
    summaryReport += `- **原版模式**: 质量要求最高的场景，但需注意Token消耗。\\n`;
    summaryReport += `- **选择性模式**: 平衡质量与效率的常规使用。\\n`;
    summaryReport += `- **优化模式**: 大批量处理，成本敏感场景的最佳选择。\\n\\n`;

    fs.writeFileSync(path.join(reportsDir, summaryReportPath), summaryReport);
    console.log(`\\n📋 主摘要报告已保存: reports/${summaryReportPath}`);
    
    return summaryReportPath;
  }

  /**
   * 清理AI结果中的<think>标签
   */
  cleanAIResults(results) {
    const cleaned = {};
    for (const key in results) {
      if (typeof results[key] === 'string') {
        // 正确的正则表达式，用于移除<think>...</think>标签块
        cleaned[key] = results[key].replace(/<think>.*?<\/think>\n?/gs, '').trim();
      } else {
        cleaned[key] = results[key];
      }
    }
    return cleaned;
  }

  /**
   * 运行完整对比测试
   */
  async runComparison() {
    console.log('🚀 开始AI处理模式对比测试');
    console.log('='.repeat(60));
    
    try {
      // 加载配置
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log(`📋 配置加载: ${configPath}`);
      
      // 提取新闻内容
      const { title, content } = await this.extractContentFromUrl(testUrl);
      this.originalTitle = title;
      this.originalContent = content;
      
      // 初始化AI管理器
      console.log('\\n🤖 初始化AI管理器...');
      const aiManager = new MultiAIManager(config);
      await aiManager.initialize();
      
      const processor = new OptimizedAIProcessor(aiManager, config);
      
      // 测试每个模式
      for (const mode of TEST_MODES) {
        await this.testMode(mode, aiManager, processor);
      }
      
      // 生成对比报告
      console.log('\\n📊 生成对比报告...');
      const reportPath = this.generateComparisonReport();
      
      // 输出总结
      console.log('\\n🎉 对比测试完成!');
      console.log('='.repeat(60));
      
      const successCount = Object.values(this.testResults).filter(r => r.success).length;
      console.log(`✅ 成功模式: ${successCount}/${TEST_MODES.length}`);
      
      if (successCount > 0) {
        const totalTime = Object.values(this.testResults).reduce((sum, r) => sum + r.duration, 0);
        const totalCalls = Object.values(this.testResults).reduce((sum, r) => sum + r.apiCallCount, 0);
        const totalCost = Object.values(this.testResults).reduce((sum, r) => sum + r.estimatedCost, 0);
        
        console.log(`⏱️ 总测试时间: ${totalTime.toFixed(2)}秒`);
        console.log(`📊 总API调用: ${totalCalls}次`);
        console.log(`💰 总预估成本: $${totalCost.toFixed(6)}`);
      }
      
    } catch (error) {
      console.error(`❌ 测试失败: ${error.message}`);
      process.exit(1);
    }
  }
}

// 主执行函数
async function main() {
  const tester = new ModeComparisonTester();
  await tester.runComparison();
}

// 运行测试
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { ModeComparisonTester };
