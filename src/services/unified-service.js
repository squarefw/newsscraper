#!/usr/bin/env node

/**
 * NewsScraper 统一处理服务
 * 合并发现和处理功能，持续运行的服务
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 配置参数
const CONFIG_PATH = process.argv[2] || 'config/config.remote-230.json';
const DISCOVERY_INTERVAL = 30 * 60 * 1000; // 30分钟运行一次发现
const PROCESSING_INTERVAL = 10 * 60 * 1000; // 10分钟检查一次处理队列

// 解析配置路径
// 配置文件路径
const configFile = process.argv[2] || 'config/config.remote-aliyun.json';
const urlsFile = 'temp/pending-urls.txt';
const configPath = path.resolve(configFile);

console.log('🚀 NewsScraper 统一处理服务启动');
console.log('======================================');
console.log(`📋 配置文件: ${configPath}`);
console.log(`🔍 发现间隔: ${DISCOVERY_INTERVAL / 1000 / 60}分钟`);
console.log(`📝 处理间隔: ${PROCESSING_INTERVAL / 1000 / 60}分钟`);
console.log('======================================\n');

// 运行发现脚本
async function runDiscovery() {
  return new Promise((resolve, reject) => {
    console.log(`\n🔍 [${new Date().toLocaleString()}] 开始新闻发现...`);
    
    const child = spawn('node', [
      path.resolve(__dirname, 'discover-and-queue.js'),
      configPath
    ], {
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ [${new Date().toLocaleString()}] 新闻发现完成`);
        resolve();
      } else {
        console.error(`❌ [${new Date().toLocaleString()}] 新闻发现失败，退出码: ${code}`);
        reject(new Error(`Discovery failed with code ${code}`));
      }
    });

    child.on('error', (error) => {
      console.error(`❌ [${new Date().toLocaleString()}] 新闻发现进程错误:`, error);
      reject(error);
    });
  });
}

// 运行处理脚本
async function runProcessing() {
  return new Promise((resolve, reject) => {
    // 检查队列文件是否存在且有内容
    const queueFile = path.resolve(__dirname, '../../temp/pending-urls.txt');
    
    if (!fs.existsSync(queueFile)) {
      console.log(`📝 [${new Date().toLocaleString()}] 队列文件不存在，跳过处理`);
      resolve();
      return;
    }

    const content = fs.readFileSync(queueFile, 'utf8').trim();
    if (!content) {
      console.log(`📝 [${new Date().toLocaleString()}] 队列文件为空，跳过处理`);
      resolve();
      return;
    }

    const urlCount = content.split('\n').filter(line => line.trim()).length;
    console.log(`\n📝 [${new Date().toLocaleString()}] 开始处理 ${urlCount} 个URL...`);
    
    const child = spawn('node', [
      path.resolve(__dirname, 'batch-ai-push.js'),
      configPath,
      queueFile
    ], {
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ [${new Date().toLocaleString()}] 新闻处理完成`);
        // 处理完成后清空队列文件
        fs.writeFileSync(queueFile, '', 'utf8');
        console.log(`🗑️ [${new Date().toLocaleString()}] 队列文件已清空`);
        resolve();
      } else {
        console.error(`❌ [${new Date().toLocaleString()}] 新闻处理失败，退出码: ${code}`);
        reject(new Error(`Processing failed with code ${code}`));
      }
    });

    child.on('error', (error) => {
      console.error(`❌ [${new Date().toLocaleString()}] 新闻处理进程错误:`, error);
      reject(error);
    });
  });
}

// 主循环
async function mainLoop() {
  let discoveryTimer = 0;
  let processingTimer = 0;
  
  // 立即运行一次发现
  try {
    await runDiscovery();
  } catch (error) {
    console.error('初始发现失败:', error.message);
  }

  // 设置定时器
  const mainInterval = setInterval(async () => {
    const now = Date.now();
    
    try {
      // 检查是否需要运行发现
      if (now - discoveryTimer >= DISCOVERY_INTERVAL) {
        await runDiscovery();
        discoveryTimer = now;
      }
      
      // 检查是否需要运行处理
      if (now - processingTimer >= PROCESSING_INTERVAL) {
        await runProcessing();
        processingTimer = now;
      }
      
    } catch (error) {
      console.error(`主循环错误: ${error.message}`);
    }
  }, 60000); // 每分钟检查一次

  // 处理退出信号
  process.on('SIGINT', () => {
    console.log('\n🛑 收到退出信号，正在关闭...');
    clearInterval(mainInterval);
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 收到终止信号，正在关闭...');
    clearInterval(mainInterval);
    process.exit(0);
  });

  console.log('🎯 服务已启动，等待定时任务...');
  console.log(`下次发现: ${new Date(Date.now() + DISCOVERY_INTERVAL).toLocaleString()}`);
  console.log(`下次处理: ${new Date(Date.now() + PROCESSING_INTERVAL).toLocaleString()}`);
}

// 启动服务
mainLoop().catch(error => {
  console.error('服务启动失败:', error);
  process.exit(1);
});
