#!/usr/bin/env node

/**
 * NewsScraper 统一处理服务 - Cron调度版本
 * 基于cron表达式的定时调度，支持灵活的时间配置
 */

const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { spawn } = require('child_process');

// 配置文件路径
const configFile = process.argv[2] || 'config/config.remote-aliyun.json';
const urlsFile = 'examples/pending-urls.txt';
const configPath = path.resolve(configFile);

// Cron调度配置
const CRON_SCHEDULES = {
    // 每日00:00执行完整新闻发现和处理
    dailyFullRun: '0 0 * * *',          // 每天00:00
    
    // 以下任务暂时禁用
    // discoveryRun: '0 */6 * * *',        // 每6小时
    // processingCheck: '0 */2 * * *',     // 每2小时
    // quickProcess: '0 * * * *'           // 每小时
};

console.log('🚀 NewsScraper 统一处理服务启动 (Cron调度)');
console.log('======================================');
console.log(`📋 配置文件: ${configPath}`);
console.log('📅 调度计划:');
console.log(`   🌅 每日完整运行: ${CRON_SCHEDULES.dailyFullRun} (00:00)`);
console.log('   ⏸️  其他调度任务已暂时禁用');
console.log('======================================\n');

// 状态跟踪
let isRunning = {
    discovery: false,
    processing: false,
    fullRun: false
};

// 运行发现脚本
async function runDiscovery() {
    if (isRunning.discovery) {
        console.log('🔍 发现任务已在运行中，跳过...');
        return;
    }

    isRunning.discovery = true;
    const timestamp = new Date().toLocaleString();
    console.log(`🔍 [${timestamp}] 开始新闻发现...`);

    try {
        const discovery = spawn('node', ['tools/production/discover-and-queue.js', configFile], {
            stdio: 'inherit',
            cwd: process.cwd()
        });

        discovery.on('close', (code) => {
            isRunning.discovery = false;
            if (code === 0) {
                console.log(`✅ [${new Date().toLocaleString()}] 新闻发现完成`);
            } else {
                console.log(`❌ [${new Date().toLocaleString()}] 新闻发现失败，退出码: ${code}`);
            }
        });

        discovery.on('error', (error) => {
            isRunning.discovery = false;
            console.error(`❌ [${new Date().toLocaleString()}] 新闻发现出错:`, error.message);
        });

    } catch (error) {
        isRunning.discovery = false;
        console.error(`❌ [${new Date().toLocaleString()}] 启动新闻发现失败:`, error.message);
    }
}

// 运行处理脚本
async function runProcessing() {
    if (isRunning.processing) {
        console.log('📝 处理任务已在运行中，跳过...');
        return;
    }

    // 检查是否有待处理的URL
    if (!fs.existsSync(urlsFile) || fs.readFileSync(urlsFile, 'utf8').trim().length === 0) {
        console.log(`📝 [${new Date().toLocaleString()}] 没有待处理的URL，跳过处理`);
        return;
    }

    isRunning.processing = true;
    const timestamp = new Date().toLocaleString();
    console.log(`📝 [${timestamp}] 开始处理队列...`);

    try {
        const processing = spawn('node', ['tools/production/batch-ai-push.js', configFile, urlsFile], {
            stdio: 'inherit',
            cwd: process.cwd()
        });

        processing.on('close', (code) => {
            isRunning.processing = false;
            if (code === 0) {
                console.log(`✅ [${new Date().toLocaleString()}] 文章处理完成`);
            } else {
                console.log(`❌ [${new Date().toLocaleString()}] 文章处理失败，退出码: ${code}`);
            }
        });

        processing.on('error', (error) => {
            isRunning.processing = false;
            console.error(`❌ [${new Date().toLocaleString()}] 文章处理出错:`, error.message);
        });

    } catch (error) {
        isRunning.processing = false;
        console.error(`❌ [${new Date().toLocaleString()}] 启动文章处理失败:`, error.message);
    }
}

// 完整运行 (发现 + 处理)
async function runFullProcess() {
    if (isRunning.fullRun || isRunning.discovery || isRunning.processing) {
        console.log('🌅 完整运行已在进行中或有其他任务运行，跳过...');
        return;
    }

    isRunning.fullRun = true;
    const timestamp = new Date().toLocaleString();
    console.log(`🌅 [${timestamp}] 开始每日完整运行...`);

    try {
        // 先运行发现
        await new Promise((resolve) => {
            const discovery = spawn('node', ['tools/production/discover-and-queue.js', configFile], {
                stdio: 'inherit',
                cwd: process.cwd()
            });

            discovery.on('close', (code) => {
                console.log(`🔍 发现阶段完成，退出码: ${code}`);
                resolve();
            });

            discovery.on('error', (error) => {
                console.error(`❌ 发现阶段出错:`, error.message);
                resolve();
            });
        });

        // 等待一分钟后开始处理
        console.log('⏳ 等待1分钟后开始处理...');
        await new Promise(resolve => setTimeout(resolve, 60000));

        // 运行处理
        await new Promise((resolve) => {
            if (fs.existsSync(urlsFile) && fs.readFileSync(urlsFile, 'utf8').trim().length > 0) {
                const processing = spawn('node', ['tools/production/batch-ai-push.js', configFile, urlsFile], {
                    stdio: 'inherit',
                    cwd: process.cwd()
                });

                processing.on('close', (code) => {
                    console.log(`📝 处理阶段完成，退出码: ${code}`);
                    resolve();
                });

                processing.on('error', (error) => {
                    console.error(`❌ 处理阶段出错:`, error.message);
                    resolve();
                });
            } else {
                console.log('📝 没有待处理的URL');
                resolve();
            }
        });

        console.log(`✅ [${new Date().toLocaleString()}] 每日完整运行完成`);

    } catch (error) {
        console.error(`❌ [${new Date().toLocaleString()}] 每日完整运行失败:`, error.message);
    }

    isRunning.fullRun = false;
}

// 快速处理 (仅处理已有队列)
async function runQuickProcess() {
    if (isRunning.processing || isRunning.fullRun) {
        console.log('⚡ 其他处理任务正在运行，跳过快速处理...');
        return;
    }

    const timestamp = new Date().toLocaleString();
    console.log(`⚡ [${timestamp}] 快速处理检查...`);

    if (!fs.existsSync(urlsFile)) {
        console.log('📂 队列文件不存在，跳过处理');
        return;
    }

    const urls = fs.readFileSync(urlsFile, 'utf8').trim();
    if (urls.length === 0) {
        console.log('📝 队列为空，跳过处理');
        return;
    }

    const urlCount = urls.split('\n').filter(line => line.trim()).length;
    console.log(`📊 发现 ${urlCount} 个待处理URL，开始快速处理...`);

    await runProcessing();
}

// 设置cron任务
console.log('📅 设置定时任务...\n');

// 每日00:00完整运行
cron.schedule(CRON_SCHEDULES.dailyFullRun, () => {
    console.log('\n🌅 ===== 每日完整运行触发 =====');
    runFullProcess();
}, {
    timezone: "Europe/Dublin"
});

// 以下调度任务已禁用
/*
// 每6小时发现任务
cron.schedule(CRON_SCHEDULES.discoveryRun, () => {
    console.log('\n🔍 ===== 发现任务触发 =====');
    runDiscovery();
}, {
    timezone: "Europe/Dublin"
});

// 每2小时处理检查
cron.schedule(CRON_SCHEDULES.processingCheck, () => {
    console.log('\n📝 ===== 处理检查触发 =====');
    runProcessing();
}, {
    timezone: "Europe/Dublin"
});

// 每小时快速处理
cron.schedule(CRON_SCHEDULES.quickProcess, () => {
    console.log('\n⚡ ===== 快速处理触发 =====');
    runQuickProcess();
}, {
    timezone: "Europe/Dublin"
});
*/

// 启动时运行一次状态检查 (不执行处理)
setTimeout(() => {
    console.log('\n🚀 ===== 启动时状态检查 =====');
    const timestamp = new Date().toLocaleString();
    console.log(`📊 [${timestamp}] 服务启动完成，等待每日00:00触发`);
    
    // 检查队列状态但不处理
    if (fs.existsSync(urlsFile)) {
        const urls = fs.readFileSync(urlsFile, 'utf8').trim();
        if (urls.length > 0) {
            const urlCount = urls.split('\n').filter(line => line.trim()).length;
            console.log(`📋 当前队列中有 ${urlCount} 个待处理URL`);
        } else {
            console.log('📋 当前队列为空');
        }
    } else {
        console.log('📋 队列文件不存在');
    }
}, 5000); // 启动5秒后执行

// 优雅退出处理
process.on('SIGTERM', () => {
    console.log('\n🛑 接收到SIGTERM信号，正在优雅退出...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n🛑 接收到SIGINT信号，正在优雅退出...');
    process.exit(0);
});

console.log('✅ 定时任务已设置完成');
console.log('🔄 服务正在运行，等待定时触发...\n');

// 保持进程运行
setInterval(() => {
    // 每小时输出一次状态
    const now = new Date();
    if (now.getMinutes() === 0 && now.getSeconds() < 10) {
        console.log(`💓 [${now.toLocaleString()}] 服务运行中... (发现:${isRunning.discovery ? '运行' : '空闲'}, 处理:${isRunning.processing ? '运行' : '空闲'}, 完整:${isRunning.fullRun ? '运行' : '空闲'})`);
    }
}, 10000); // 每10秒检查一次
