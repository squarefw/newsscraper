#!/usr/bin/env node

/**
 * 配置重构测试脚本
 * 验证新的targets.json配置结构是否正常工作
 */

const fs = require('fs');
const path = require('path');

/**
 * 加载配置文件
 */
const loadConfig = (configPath) => {
  try {
    console.log(`📋 加载配置文件: ${configPath}`);
    if (!fs.existsSync(configPath)) {
      throw new Error(`配置文件不存在: ${configPath}`);
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    throw new Error(`配置文件加载失败: ${error.message}`);
  }
};

/**
 * 加载新闻源目标配置
 */
const loadTargets = (targetsPath) => {
  try {
    console.log(`📋 加载新闻源配置: ${targetsPath}`);
    if (!fs.existsSync(targetsPath)) {
      throw new Error(`新闻源配置文件不存在: ${targetsPath}`);
    }
    const targets = JSON.parse(fs.readFileSync(targetsPath, 'utf8'));
    
    // 只返回启用的新闻源
    const enabledTargets = targets.filter(target => target.enabled !== false);
    console.log(`✅ 成功加载 ${enabledTargets.length} 个启用的新闻源`);
    
    return enabledTargets;
  } catch (error) {
    throw new Error(`新闻源配置加载失败: ${error.message}`);
  }
};

/**
 * 测试配置重构
 */
async function testConfigRefactor() {
  console.log('🧪 配置重构测试开始');
  console.log('=======================================\n');

  try {
    // 1. 加载主配置
    const configPath = path.resolve(__dirname, '../../config/config.remote-230.json');
    const config = loadConfig(configPath);
    
    console.log('📊 主配置文件信息:');
    console.log(`   - 发现功能启用: ${config.discovery?.enabled}`);
    console.log(`   - 输出文件: ${config.discovery?.outputUrlFile}`);
    console.log(`   - 目标文件: ${config.discovery?.targetsFile}`);
    console.log(`   - 去重启用: ${config.discovery?.deduplication?.enabled}`);
    console.log('');

    // 2. 加载新闻源配置
    const targetsPath = path.resolve(__dirname, '../../', config.discovery.targetsFile || 'config/targets.json');
    const targets = loadTargets(targetsPath);
    
    console.log('📊 新闻源配置信息:');
    targets.forEach((target, index) => {
      console.log(`   ${index + 1}. ${target.name}`);
      console.log(`      URL: ${target.url}`);
      console.log(`      类型: ${target.type || '传统新闻网站'}`);
      console.log(`      关键词: [${target.keywords.join(', ')}]`);
      console.log(`      启用状态: ${target.enabled !== false ? '✅ 启用' : '❌ 禁用'}`);
      console.log(`      调度: ${target.schedule}`);
      console.log('');
    });

    // 3. 验证Google News配置
    const googleNewsSources = targets.filter(target => target.type === 'google-news');
    console.log(`📊 Google News 源统计:`);
    console.log(`   - 总数: ${googleNewsSources.length} 个`);
    googleNewsSources.forEach((source, index) => {
      console.log(`   ${index + 1}. ${source.name}`);
      console.log(`      主题: ${source.url.includes('CAAqJQgKIh9DQkFTRVFvSUwyMHZNREpqWm5RU0JXVnVMVWRDS0FBUAE') ? 'Dublin' : 'Ireland'}`);
    });
    console.log('');

    // 4. 验证配置一致性
    console.log('🔍 配置一致性检查:');
    const issues = [];
    
    targets.forEach((target, index) => {
      if (!target.name) issues.push(`目标 ${index + 1}: 缺少名称`);
      if (!target.url) issues.push(`目标 ${index + 1}: 缺少URL`);
      if (!target.keywords || !Array.isArray(target.keywords) || target.keywords.length === 0) {
        issues.push(`目标 ${index + 1}: 关键词配置无效`);
      }
      if (!target.schedule) issues.push(`目标 ${index + 1}: 缺少调度配置`);
    });

    if (issues.length === 0) {
      console.log('   ✅ 所有配置检查通过');
    } else {
      console.log('   ❌ 发现配置问题:');
      issues.forEach(issue => console.log(`      - ${issue}`));
    }
    console.log('');

    // 5. 生成配置摘要报告
    const summary = {
      timestamp: new Date().toISOString(),
      mainConfig: {
        discoveryEnabled: config.discovery?.enabled,
        outputFile: config.discovery?.outputUrlFile,
        targetsFile: config.discovery?.targetsFile,
        deduplicationEnabled: config.discovery?.deduplication?.enabled
      },
      targets: {
        total: targets.length,
        enabled: targets.filter(t => t.enabled !== false).length,
        googleNews: googleNewsSources.length,
        traditional: targets.filter(t => t.type !== 'google-news').length
      },
      configurationIssues: issues,
      status: issues.length === 0 ? 'valid' : 'has_issues'
    };

    const reportPath = path.resolve(__dirname, '../../reports/config-refactor-test.json');
    fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
    console.log(`📄 配置测试报告已保存到: ${reportPath}`);

    console.log('\n🎉 配置重构测试完成！');
    console.log(`📊 最终统计: ${targets.length} 个新闻源 (${googleNewsSources.length} 个Google News + ${targets.length - googleNewsSources.length} 个传统网站)`);
    
  } catch (error) {
    console.error('\n❌ 配置测试失败:', error.message);
  }
}

if (require.main === module) {
  testConfigRefactor();
}
