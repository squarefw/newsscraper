#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 从环境变量或命令行参数获取服务器URL
const SERVER_URL = process.env.REMOTE_SERVER_URL || process.argv[2] || 'http://65.49.214.228/api';
const configPath = '../../config/config.remote.json';

async function getAuthToken() {
  try {
    console.log('正在获取认证token...');
    
    const response = await axios.post(`${SERVER_URL}/auth/login`, {
      email: 'admin@admin.com',
      password: '123456'
    });
    
    const token = response.data.accessToken;
    console.log('✅ 成功获取token');
    
    // 读取现有配置
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    
    // 更新配置中的apiKey
    config.api.apiKey = token;
    
    // 写回配置文件
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    
    console.log('✅ 配置文件已更新:', CONFIG_FILE);
    console.log('📝 Token 前缀:', token.substring(0, 50) + '...');
    
    return token;
  } catch (error) {
    console.error('❌ 获取token失败:', error.response?.data || error.message);
    throw error;
  }
}

async function testAPI(token) {
  try {
    console.log('\n🧪 测试API连接...');
    
    // 测试获取分类
    const categoriesResponse = await axios.get(`${SERVER_URL}/categories`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ API连接正常');
    console.log('📂 可用分类:', categoriesResponse.data.length, '个');
    
    return true;
  } catch (error) {
    console.error('❌ API测试失败:', error.response?.data || error.message);
    return false;
  }
}

async function main() {
  try {
    const token = await getAuthToken();
    const apiWorking = await testAPI(token);
    
    if (apiWorking) {
      console.log('\n🎉 配置完成！现在可以运行 newsscraper 来推送新闻了');
      console.log('💡 使用命令: NODE_ENV=remote npm run dev');
    } else {
      console.log('\n⚠️  配置已更新，但API测试失败，请检查服务器状态');
    }
  } catch (error) {
    console.error('配置失败:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
