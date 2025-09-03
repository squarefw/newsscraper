#!/usr/bin/env node

/**
 * Docker环境诊断脚本
 */

async function diagnosticDockerEnvironment() {
    console.log('🔍 开始Docker环境诊断...');
    
    // 1. 检查Node.js和系统信息
    console.log('\n📋 系统信息:');
    console.log(`Node.js版本: ${process.version}`);
    console.log(`操作系统: ${process.platform}`);
    console.log(`架构: ${process.arch}`);
    
    // 2. 检查Chromium是否可用
    console.log('\n🔍 Chromium检查:');
    const fs = require('fs');
    const chromiumPaths = [
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/usr/bin/google-chrome'
    ];
    
    for (const path of chromiumPaths) {
        if (fs.existsSync(path)) {
            console.log(`✅ 找到Chromium: ${path}`);
            try {
                const { execSync } = require('child_process');
                const version = execSync(`${path} --version`, { encoding: 'utf8' });
                console.log(`   版本: ${version.trim()}`);
            } catch (e) {
                console.log(`   ⚠️ 无法获取版本: ${e.message}`);
            }
        } else {
            console.log(`❌ 未找到: ${path}`);
        }
    }
    
    // 3. 检查环境变量
    console.log('\n🔍 环境变量:');
    console.log(`PUPPETEER_EXECUTABLE_PATH: ${process.env.PUPPETEER_EXECUTABLE_PATH || '未设置'}`);
    console.log(`DISPLAY: ${process.env.DISPLAY || '未设置'}`);
    console.log(`NODE_ENV: ${process.env.NODE_ENV || '未设置'}`);
    
    // 4. 尝试最基础的axios请求
    console.log('\n🌐 测试网络连接:');
    try {
        const axios = require('axios');
        const response = await axios.get('https://www.google.com', {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
            }
        });
        console.log(`✅ 网络连接正常，状态码: ${response.status}`);
    } catch (error) {
        console.log(`❌ 网络连接失败: ${error.message}`);
    }
    
    // 5. 尝试最基础的Puppeteer启动
    console.log('\n🎭 Puppeteer基础测试:');
    try {
        const puppeteer = require('puppeteer');
        
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--single-process',
                '--no-zygote'
            ],
            executablePath: '/usr/bin/chromium-browser',
            timeout: 10000
        });
        
        console.log('✅ Puppeteer浏览器启动成功');
        
        const page = await browser.newPage();
        console.log('✅ 页面创建成功');
        
        await page.goto('https://www.google.com', { timeout: 10000 });
        console.log('✅ 页面导航成功');
        
        const title = await page.title();
        console.log(`✅ 页面标题: ${title}`);
        
        await browser.close();
        console.log('✅ Puppeteer测试完成');
        
    } catch (error) {
        console.log(`❌ Puppeteer测试失败: ${error.message}`);
        console.log(`错误堆栈: ${error.stack}`);
    }
    
    console.log('\n🏁 诊断完成');
}

if (require.main === module) {
    diagnosticDockerEnvironment().catch(console.error);
}
