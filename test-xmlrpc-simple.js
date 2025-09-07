#!/usr/bin/env node

/**
 * 简化的XML-RPC测试脚本
 */

const path = require('path');
const ConfigLoader = require('./config/config-loader');

async function quickXMLRPCTest() {
  console.log('🧪 快速XML-RPC测试');
  console.log('======================\n');

  // 1. 加载配置
  const configPath = path.resolve(__dirname, 'config/config.remote-aliyun.json');
  const configLoader = new ConfigLoader();
  const config = configLoader.loadConfig(configPath, 'remote-aliyun');
  
  const wordpress = config.wordpress;
  console.log(`WordPress URL: ${wordpress.siteUrl}`);
  console.log(`用户名: ${wordpress.username}`);
  console.log(`密码长度: ${wordpress.password.length}\n`);

  // 2. 发送XML-RPC请求
  const https = require('https');
  const http = require('http');
  const { URL } = require('url');

  return new Promise((resolve, reject) => {
    const xmlrpcUrl = `${wordpress.siteUrl}/xmlrpc.php`;
    const url = new URL(xmlrpcUrl);
    const client = url.protocol === 'https:' ? https : http;
    
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

    console.log(`🌐 请求URL: ${xmlrpcUrl}`);
    console.log(`📤 请求大小: ${Buffer.byteLength(xmlRequest)} 字节\n`);

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
      console.log(`📡 状态码: ${res.statusCode} ${res.statusMessage}`);
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`📥 响应大小: ${data.length} 字符\n`);
        
        // 分析响应
        if (res.statusCode !== 200) {
          console.log(`❌ HTTP错误: ${res.statusCode}`);
        } else if (data.includes('faultCode')) {
          const faultMatch = data.match(/<name>faultString<\/name><value><string>([^<]+)<\/string>/);
          const errorMsg = faultMatch ? faultMatch[1] : 'XML-RPC调用失败';
          console.log(`❌ XML-RPC错误: ${errorMsg}`);
        } else {
          console.log(`✅ XML-RPC调用成功！\n`);
          
          // 检查现有的判断条件
          console.log('🔍 分析响应内容:');
          console.log(`包含空数组条件1: ${data.includes('<array><data></data></array>')}`);
          console.log(`包含空数组条件2: ${data.includes('<array><data>\\n</data></array>')}`);
          
          // 查找日期
          const dateMatch = data.match(/<name>post_date<\/name><value><dateTime\.iso8601>([^<]+)<\/dateTime\.iso8601>/);
          if (dateMatch) {
            console.log(`📅 找到日期: ${dateMatch[1]}`);
            
            // 解析日期
            const dateString = dateMatch[1];
            let parsedDate;
            
            // 尝试标准ISO格式
            parsedDate = new Date(dateString);
            if (!isNaN(parsedDate.getTime())) {
              console.log(`📅 标准解析成功: ${parsedDate.toISOString()}`);
            } else {
              // 尝试WordPress格式
              const wpMatch = dateString.match(/^(\\d{4})(\\d{2})(\\d{2})T(\\d{2}):(\\d{2}):(\\d{2})$/);
              if (wpMatch) {
                const [, year, month, day, hour, minute, second] = wpMatch;
                parsedDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
                console.log(`📅 WordPress格式解析成功: ${parsedDate.toISOString()}`);
              } else {
                console.log(`❌ 无法解析日期格式: ${dateString}`);
              }
            }
          } else {
            console.log(`⚠️ 响应中未找到日期字段`);
          }
        }
        
        console.log('\\n📄 响应内容（前2000字符）:');
        console.log(data.substring(0, 2000));
        if (data.length > 2000) {
          console.log('...(内容被截断)');
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
  });
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

if (require.main === module) {
  quickXMLRPCTest().catch(console.error);
}
