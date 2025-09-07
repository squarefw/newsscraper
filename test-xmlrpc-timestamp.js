#!/usr/bin/env node

/**
 * XML-RPC 时间戳功能测试脚本
 * 用于检查WordPress XML-RPC获取最新文章时间的功能
 */

const path = require('path');
const ConfigLoader = require('./config/config-loader');
const ExecutionStateManager = require('./utils/executionStateManager');

/**
 * 测试XML-RPC连接和时间戳获取
 */
async function testXMLRPCTimestamp() {
  console.log('🧪 XML-RPC 时间戳功能测试');
  console.log('==========================================\n');

  try {
    // 1. 加载配置文件
    const configPath = process.argv[2] || 'config/config.remote-aliyun.json';
    const fullConfigPath = path.resolve(__dirname, configPath);
    
    console.log(`📋 加载配置文件: ${fullConfigPath}`);
    
    const configLoader = new ConfigLoader();
    const environment = configLoader.inferEnvironment(fullConfigPath);
    const config = configLoader.loadConfig(fullConfigPath, environment);
    
    console.log(`✅ 配置加载成功，环境: ${environment}\n`);

    // 2. 检查WordPress配置
    console.log('🔍 检查WordPress配置...');
    const wordpress = config.wordpress;
    
    if (!wordpress) {
      throw new Error('配置中未找到WordPress部分');
    }
    
    console.log(`   站点URL: ${wordpress.siteUrl}`);
    console.log(`   用户名: ${wordpress.username}`);
    console.log(`   密码长度: ${wordpress.password ? wordpress.password.length : 0} 字符`);
    
    if (!wordpress.siteUrl || !wordpress.username || !wordpress.password) {
      throw new Error('WordPress配置不完整，缺少必要字段');
    }

    // 3. 初始化执行状态管理器
    console.log('\n🔧 初始化执行状态管理器...');
    const stateManager = new ExecutionStateManager(config);
    
    // 4. 测试XML-RPC连接
    console.log('\n📡 测试XML-RPC连接...');
    console.log('------------------------------------------');
    
    try {
      const latestTime = await stateManager.getLatestPostTimeViaXMLRPC();
      console.log(`✅ XML-RPC连接成功！`);
      console.log(`📅 最新文章时间: ${latestTime.toISOString()}`);
      console.log(`🕐 当前时间: ${new Date().toISOString()}`);
      
      const timeDiff = (new Date() - latestTime) / (1000 * 60 * 60); // 小时差
      console.log(`⏱️ 时间差: ${timeDiff.toFixed(2)} 小时`);
      
    } catch (xmlrpcError) {
      console.log(`❌ XML-RPC连接失败: ${xmlrpcError.message}`);
      console.log(`🔍 详细错误信息: ${xmlrpcError.stack}`);
    }

    // 5. 测试完整的获取最新时间戳流程
    console.log('\n🎯 测试完整的获取时间戳流程...');
    console.log('------------------------------------------');
    
    try {
      const lastExecutionTime = await stateManager.getLastExecutionTime();
      console.log(`✅ 获取时间戳成功！`);
      console.log(`📅 基准时间: ${lastExecutionTime.toISOString()}`);
      console.log(`🔧 状态模式: ${stateManager.getStateModeDescription()}`);
      
    } catch (fullError) {
      console.log(`❌ 获取时间戳失败: ${fullError.message}`);
      console.log(`🔍 详细错误信息: ${fullError.stack}`);
    }

    // 6. 测试直接的XML-RPC请求
    console.log('\n🛠️ 测试原始XML-RPC请求...');
    console.log('------------------------------------------');
    
    await testRawXMLRPC(wordpress);

  } catch (error) {
    console.error(`\n❌ 测试失败: ${error.message}`);
    console.error(`🔍 详细错误信息: ${error.stack}`);
    process.exit(1);
  }
}

/**
 * 测试原始的XML-RPC请求
 */
async function testRawXMLRPC(wordpress) {
  const https = require('https');
  const http = require('http');
  const { URL } = require('url');

  return new Promise((resolve, reject) => {
    try {
      const xmlrpcUrl = `${wordpress.siteUrl}/xmlrpc.php`;
      console.log(`🌐 XML-RPC URL: ${xmlrpcUrl}`);
      
      const url = new URL(xmlrpcUrl);
      const client = url.protocol === 'https:' ? https : http;
      
      // 构建XML-RPC请求
      const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<methodCall>
  <methodName>wp.getPosts</methodName>
  <params>
    <param><value><string>1</string></value></param>
    <param><value><string>${escapeXml(wordpress.username)}</string></value></param>
    <param><value><string>${escapeXml(wordpress.password)}</string></value></param>
    <param><value>
      <struct>
        <member><name>number</name><value><int>1</int></value></member>
        <member><name>post_status</name><value><string>publish</string></value></member>
        <member><name>orderby</name><value><string>post_date</string></value></member>
        <member><name>order</name><value><string>DESC</string></value></member>
      </struct>
    </value></param>
  </params>
</methodCall>`;

      console.log(`📤 发送XML请求 (${Buffer.byteLength(xmlRequest)} 字节)`);
      console.log(`🔒 使用凭据: ${wordpress.username}:${'*'.repeat(wordpress.password.length)}`);

      const req = client.request({
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
          'Content-Length': Buffer.byteLength(xmlRequest),
          'User-Agent': 'NewsScraperBot/1.0 (Test)'
        },
        timeout: 15000
      }, (res) => {
        console.log(`📡 HTTP状态: ${res.statusCode} ${res.statusMessage}`);
        console.log(`📋 响应头:`, res.headers);
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log(`📥 响应大小: ${data.length} 字符`);
          console.log(`📄 响应内容（前1000字符）:`);
          console.log(data.substring(0, 1000));
          console.log('...\n');

          // 分析响应
          if (res.statusCode !== 200) {
            console.log(`❌ HTTP错误: ${res.statusCode}`);
          } else if (data.includes('faultCode')) {
            const faultMatch = data.match(/<name>faultString<\/name><value><string>([^<]+)<\/string>/);
            const errorMsg = faultMatch ? faultMatch[1] : 'XML-RPC调用失败';
            console.log(`❌ XML-RPC错误: ${errorMsg}`);
          } else if (data.includes('<array><data></data></array>')) {
            console.log(`📝 WordPress中没有文章`);
          } else {
            console.log(`✅ XML-RPC调用成功！`);
            
            // 尝试解析日期
            const dateMatch = data.match(/<name>post_date<\/name><value><dateTime\.iso8601>([^<]+)<\/dateTime\.iso8601>/);
            if (dateMatch) {
              console.log(`📅 找到文章日期: ${dateMatch[1]}`);
              try {
                const parsedDate = parseWordPressDate(dateMatch[1]);
                console.log(`📅 解析后的日期: ${parsedDate.toISOString()}`);
              } catch (parseError) {
                console.log(`❌ 日期解析失败: ${parseError.message}`);
              }
            } else {
              console.log(`⚠️ 响应中未找到文章日期`);
            }
          }
          
          resolve();
        });
      });
      
      req.on('error', (error) => {
        console.log(`❌ 请求错误: ${error.message}`);
        resolve();
      });
      
      req.on('timeout', () => {
        console.log(`⏰ 请求超时`);
        req.destroy();
        resolve();
      });
      
      req.write(xmlRequest);
      req.end();
      
    } catch (error) {
      console.log(`❌ 设置请求时出错: ${error.message}`);
      resolve();
    }
  });
}

/**
 * XML字符转义
 */
function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 解析WordPress日期格式
 */
function parseWordPressDate(dateString) {
  // 尝试标准ISO格式
  let date = new Date(dateString);
  if (!isNaN(date.getTime())) {
    return date;
  }
  
  // 尝试WordPress特有格式: YYYYMMDDTHH:MM:SS
  const wpMatch = dateString.match(/^(\d{4})(\d{2})(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
  if (wpMatch) {
    const [, year, month, day, hour, minute, second] = wpMatch;
    date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  throw new Error(`无法解析日期格式: ${dateString}`);
}

// 运行测试
if (require.main === module) {
  testXMLRPCTimestamp().catch(console.error);
}

module.exports = { testXMLRPCTimestamp };
