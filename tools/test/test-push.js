#!/usr/bin/env node

const path = require('path');

// 设置环境变量
process.env.NODE_ENV = 'remote';

// 引入构建后的模块
const { initApiClient, pushNewsArticle } = require('../../dist/apiClient');

async function testPushNews() {
  try {
    // 加载配置
    const config = require('../../config/config.remote.json');
    
    console.log('🚀 初始化API客户端...');
    const configPath = path.resolve(__dirname, '../../config/config.remote.json');
    await initApiClient(config, configPath);
    
    // 创建测试新闻
    const testArticle = {
      title: 'NewsScraper 推送测试新闻',
      content: `这是一条通过 NewsScraper 推送的测试新闻。
      
发布时间: ${new Date().toLocaleString('zh-CN')}
测试目的: 验证 NewsScraper 是否可以成功向远端服务器推送新闻

主要功能验证:
1. ✅ 远程API连接
2. ✅ JWT认证
3. ✅ 新闻内容推送
4. ✅ 分类关联

如果您看到这条新闻，说明 NewsScraper 配置正确，可以正常工作！`,
      categoryId: '550e8400-e29b-41d4-a716-446655440000', // 默认分类
      tags: ['测试', 'NewsScraper', '自动化']
    };
    
    console.log('📰 推送测试新闻...');
    console.log('标题:', testArticle.title);
    
    const result = await pushNewsArticle(testArticle);
    
    console.log('✅ 新闻推送成功！');
    console.log('📄 新闻ID:', result.id);
    console.log('📅 创建时间:', result.createdAt);
    console.log('🏷️  分类:', result.category.nameZh);
    console.log('👤 作者:', result.author.username);
    
    console.log('\n🎉 测试完成！NewsScraper 可以正常向远端服务器推送新闻');
    console.log('💡 现在可以运行完整的采集程序: NODE_ENV=remote npm run dev');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('详细错误:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testPushNews();
}
