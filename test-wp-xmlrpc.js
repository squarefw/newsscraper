/**
 * 测试WordPress XML-RPC连接
 */

const axios = require('axios');

async function testWordPressXMLRPC() {
  const wordpressUrl = 'http://8.208.23.37';
  const username = 'i0086editor';
  const password = '&orDMc*aRm4@*Jecnj(p4tA9'; // 从配置文件中获取的正确密码
  
  console.log('🔍 测试WordPress XML-RPC连接...');
  console.log(`📋 WordPress URL: ${wordpressUrl}`);
  console.log(`👤 用户名: ${username}`);
  
  // 构建XML-RPC请求
  const xmlrpcRequest = `<?xml version="1.0" encoding="UTF-8"?>
<methodCall>
  <methodName>wp.getPosts</methodName>
  <params>
    <param>
      <value><string>1</string></value>
    </param>
    <param>
      <value><string>${username.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</string></value>
    </param>
    <param>
      <value><string>${password.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</string></value>
    </param>
    <param>
      <value>
        <struct>
          <member>
            <name>number</name>
            <value><int>1</int></value>
          </member>
          <member>
            <name>orderby</name>
            <value><string>date</string></value>
          </member>
          <member>
            <name>order</name>
            <value><string>DESC</string></value>
          </member>
        </struct>
      </value>
    </param>
  </params>
</methodCall>`;

  try {
    console.log('📡 发送XML-RPC请求...');
    
    const response = await axios.post(
      `${wordpressUrl}/xmlrpc.php`,
      xmlrpcRequest,
      {
        headers: {
          'Content-Type': 'text/xml',
          'User-Agent': 'NewsScraper/1.0'
        },
        timeout: 10000
      }
    );
    
    console.log(`✅ 响应状态: ${response.status}`);
    console.log(`📄 响应长度: ${response.data.length} 字符`);
    console.log('📋 响应内容预览:');
    console.log(response.data.substring(0, 500) + '...');
    
    // 检查是否有错误
    if (response.data.includes('<fault>')) {
      console.log('❌ WordPress返回错误');
      return;
    }
    
    if (response.data.includes('<methodResponse>')) {
      console.log('✅ XML-RPC响应格式正确');
      
      // 检查是否找到文章
      if (response.data.includes('<array>') && response.data.includes('</array>')) {
        console.log('✅ 找到文章数据');
      } else {
        console.log('⚠️ 可能没有找到文章，或者网站还没有文章');
      }
    }
    
  } catch (error) {
    console.log('❌ XML-RPC请求失败:');
    console.log(`   错误类型: ${error.name}`);
    console.log(`   错误信息: ${error.message}`);
    
    if (error.response) {
      console.log(`   HTTP状态: ${error.response.status}`);
      console.log(`   响应内容: ${error.response.data?.substring(0, 200)}...`);
    }
  }
}

testWordPressXMLRPC().then(() => {
  console.log('\n🏁 测试完成');
}).catch(console.error);
