#!/bin/bash

# 新闻采集器远程推送脚本
# 使用方法: ./run-remote.sh [选项]

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📰 NewsScraper 远程推送工具${NC}"
echo "目标服务器: http://65.49.214.228"
echo ""

# 检查依赖
if [ ! -d "dist" ]; then
    echo -e "${YELLOW}⚙️  构建项目...${NC}"
    npm run build
    if [ $? -ne 0 ]; then
        echo "❌ 构建失败"
        exit 1
    fi
fi

# 更新认证token
echo -e "${YELLOW}🔑 更新认证token...${NC}"
node tools/setup-remote.js
if [ $? -ne 0 ]; then
    echo "❌ 认证失败"
    exit 1
fi

echo ""
echo -e "${GREEN}选择运行模式:${NC}"
echo "1. 测试推送 (推送一条测试新闻)"
echo "2. AI功能测试 (测试AI增强功能)"
echo "3. 网站抓取 (抓取配置的目标网站新闻)"
echo "4. 完整运行 (包含所有功能和定时任务)"
echo "5. 退出"
echo ""

read -p "请选择 (1-5): " choice

case $choice in
    1)
        echo -e "${YELLOW}🧪 运行测试推送...${NC}"
        node tools/test-push.js
        ;;
    2)
        echo -e "${YELLOW}🤖 开始AI功能测试...${NC}"
        echo "🧠 测试AI增强功能 (翻译、重写、摘要等)"
        NODE_ENV=remote node tools/test-ai.js
        ;;
    3)
    3)
        echo -e "${YELLOW}🕷️ 开始网站抓取...${NC}"
        echo "📡 抓取来源: BBC中文网、RTE爱尔兰新闻"
        NODE_ENV=remote node -e "
        const { scrapeNews } = require('./dist/scraper');
        const { initApiClient } = require('./dist/apiClient');
        const { AIFactory } = require('./dist/ai/factory');
        const config = require('./config/config.remote.json');
        const targets = require('./config/targets.json');
        
        (async () => {
            try {
                console.log('🚀 初始化API客户端...');
                initApiClient(config);
                
                // 初始化AI代理
                let aiAgent = null;
                if (config.ai.enabled) {
                    console.log('🤖 初始化AI代理...');
                    aiAgent = AIFactory.getAgent(config);
                    console.log('✅ AI代理创建成功');
                } else {
                    console.log('⚠️  AI功能已禁用');
                }
                
                console.log('🕷️ 开始网站新闻抓取...');
                
                for (const target of targets.filter(t => t.enabled)) {
                    console.log(\\\`正在抓取: \\\${target.name}\\\`);
                    await scrapeNews(target, aiAgent);
                }
                
                console.log('✅ 抓取完成！');
            } catch (error) {
                console.error('❌ 抓取失败:', error.message);
                process.exit(1);
            }
        })();
        "
        ;;
    4)
        echo -e "${YELLOW}🔄 启动完整新闻采集服务...${NC}"
        echo "包含: 外部新闻API + 网站抓取 + 定时任务"
        echo "按 Ctrl+C 停止服务"
        NODE_ENV=remote npm run dev
        ;;
    5)
        echo "👋 再见！"
        exit 0
        ;;
    *)
        echo "❌ 无效选择"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ 操作完成！${NC}"
echo "💡 提示: 可以访问 http://65.49.214.228 查看推送的新闻"
