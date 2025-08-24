#!/usr/bin/env node

/**
 * 完整端到端测试：Google News RSS → AI 处理 → WordPress 发布
 * 测试整个新闻处理流水线
 */

const fs = require('fs');
const path = require('path');

// 动态加载必要的模块
const RSSGoogleNewsAnalyzer = require('./utils/rssGoogleNewsAnalyzer');
const { resolveGoogleNewsUrls } = require('./utils/puppeteerResolver');

// 检查配置文件是否存在
const checkConfigFile = (configPath) => {
  if (!fs.existsSync(configPath)) {
    console.log(`⚠️  配置文件不存在: ${configPath}`);
    return false;
  }
  return true;
};

// 加载配置
const loadConfig = (configPath) => {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log(`✅ 配置加载成功: ${configPath}`);
    return config;
  } catch (error) {
    console.error(`❌ 配置加载失败: ${error.message}`);
    return null;
  }
};

// 创建临时 URL 文件
const createTempUrlFile = async (urls) => {
  const tempFile = path.join(__dirname, 'temp-test-urls.txt');
  const urlContent = urls.map(url => url).join('\n');
  
  fs.writeFileSync(tempFile, urlContent, 'utf8');
  console.log(`📝 创建临时 URL 文件: ${tempFile}`);
  console.log(`📊 包含 ${urls.length} 个 URL`);
  
  return tempFile;
};

// 清理临时文件
const cleanupTempFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🧹 清理临时文件: ${filePath}`);
    }
  } catch (error) {
    console.warn(`⚠️  清理临时文件失败: ${error.message}`);
  }
};

// 主要的端到端测试函数
async function runEndToEndTest() {
  console.log('🚀 开始完整端到端测试：Google News → AI 处理 → WordPress');
  console.log('='.repeat(80));
  
  let tempUrlFile = null;
  
  try {
    // ========== 第一步：RSS 新闻采集 ==========
    console.log('\n📡 第一步：Google News RSS 新闻采集');
    console.log('-'.repeat(50));
    
    const analyzer = new RSSGoogleNewsAnalyzer();
    const rssResult = await analyzer.processGoogleNewsUrl();
    
    if (!rssResult.success) {
      throw new Error('RSS 新闻采集失败');
    }
    
    console.log(`✅ RSS 采集成功:`);
    console.log(`   📊 发现新闻: ${rssResult.totalFound} 条`);
    console.log(`   🗓️  过滤后: ${rssResult.filtered} 条`);
    console.log(`   🎯 处理数量: ${rssResult.processed} 条`);
    
    // ========== 第二步：URL 解码处理 ==========
    console.log('\n🔍 第二步：URL 解码处理');
    console.log('-'.repeat(50));
    
    const allUrls = rssResult.articles.map(article => article.url);
    const processedUrls = await resolveGoogleNewsUrls(allUrls);
    
    console.log(`✅ URL 处理完成:`);
    console.log(`   🔗 输入: ${allUrls.length} 个 URL`);
    console.log(`   🔗 输出: ${processedUrls.length} 个 URL`);
    console.log(`   📊 处理率: ${Math.round((processedUrls.length / allUrls.length) * 100)}%`);
    
    // ========== 第三步：创建测试 URL 文件 ==========
    console.log('\n📝 第三步：准备 AI 处理数据');
    console.log('-'.repeat(50));
    
    // 使用前5个URL进行测试（减少处理时间）
    const testUrls = processedUrls.slice(0, 5);
    tempUrlFile = await createTempUrlFile(testUrls);
    
    console.log(`✅ 测试数据准备完成:`);
    console.log(`   🎯 选择 ${testUrls.length} 个 URL 进行测试`);
    
    // ========== 第四步：检查配置文件 ==========
    console.log('\n⚙️  第四步：检查系统配置');
    console.log('-'.repeat(50));
    
    const configPath = path.join(__dirname, 'config/config.development.json');
    if (!checkConfigFile(configPath)) {
      throw new Error('配置文件检查失败');
    }
    
    const config = loadConfig(configPath);
    if (!config) {
      throw new Error('配置加载失败');
    }
    
    console.log(`✅ 系统配置检查完成:`);
    console.log(`   🤖 AI 引擎: ${config.ai?.engine || '未配置'}`);
    console.log(`   📝 WordPress: ${config.wordpress?.enabled ? '启用' : '禁用'}`);
    console.log(`   🧪 测试模式: ${config.testMode ? '启用' : '关闭'}`);
    
    // ========== 第五步：运行 AI 处理和推送 ==========
    console.log('\n🤖 第五步：运行 AI 处理和 WordPress 推送');
    console.log('-'.repeat(50));
    
    // 动态加载并运行批量处理脚本
    const { spawn } = require('child_process');
    const batchScript = path.join(__dirname, 'tools/production/batch-ai-push-enhanced.js');
    
    console.log(`🔄 启动批量处理脚本...`);
    console.log(`   📜 脚本: ${batchScript}`);
    console.log(`   ⚙️  配置: ${configPath}`);
    console.log(`   📄 URL文件: ${tempUrlFile}`);
    
    return new Promise((resolve, reject) => {
      const child = spawn('node', [batchScript, configPath, tempUrlFile], {
        stdio: 'inherit',
        cwd: __dirname
      });
      
      child.on('close', (code) => {
        console.log(`\n🏁 批量处理完成，退出码: ${code}`);
        
        // 清理临时文件
        if (tempUrlFile) {
          cleanupTempFile(tempUrlFile);
        }
        
        if (code === 0) {
          console.log('✅ AI 处理和推送成功完成');
          resolve({
            success: true,
            rssArticles: rssResult.processed,
            processedUrls: processedUrls.length,
            testedUrls: testUrls.length,
            exitCode: code
          });
        } else {
          console.log('⚠️  批量处理可能存在问题');
          resolve({
            success: false,
            rssArticles: rssResult.processed,
            processedUrls: processedUrls.length,
            testedUrls: testUrls.length,
            exitCode: code
          });
        }
      });
      
      child.on('error', (error) => {
        console.error(`❌ 批量处理启动失败: ${error.message}`);
        reject(error);
      });
    });
    
  } catch (error) {
    console.error(`\n💥 端到端测试失败: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
  // 注意：临时文件的清理移到了子进程结束后
}

// 主函数
async function main() {
  try {
    const result = await runEndToEndTest();
    
    console.log('\n' + '='.repeat(80));
    console.log('🎉 端到端测试结果汇总');
    console.log('='.repeat(80));
    
    if (result.success) {
      console.log('🌟 总体状态: ✅ 完全成功');
      console.log(`📊 数据流统计:`);
      console.log(`   • RSS 新闻采集: ✅ ${result.rssArticles} 条`);
      console.log(`   • URL 处理: ✅ ${result.processedUrls} 个`);
      console.log(`   • AI 测试处理: ✅ ${result.testedUrls} 个`);
      console.log(`   • 系统退出码: ${result.exitCode}`);
      
      console.log('\n🎯 完整流程验证: 全部通过 ✅');
      console.log('📝 系统状态: 可以投入生产环境使用');
      
    } else {
      console.log('🌟 总体状态: ⚠️  部分成功');
      if (result.error) {
        console.log(`❌ 错误信息: ${result.error}`);
      }
      if (result.exitCode !== undefined) {
        console.log(`📊 批量处理退出码: ${result.exitCode}`);
      }
      console.log('🔧 建议: 检查配置和日志，调试具体问题');
    }
    
    console.log('\n📋 端到端测试完成');
    process.exit(result.success ? 0 : 1);
    
  } catch (error) {
    console.error(`\n💥 测试执行异常: ${error.message}`);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  main();
}

module.exports = { runEndToEndTest };
