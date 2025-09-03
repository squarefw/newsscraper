#!/bin/bash

# 远程部署状态查看脚本

REMOTE_HOST="${1:-weifang@192.168.1.230}"
DEPLOY_DIR="/home/weifang/newsscraper"

echo "========================================"
echo "🚀 NewsScraper 部署状态检查"
echo "========================================"
echo "远程服务器: ${REMOTE_HOST}"
echo "部署目录: ${DEPLOY_DIR}"
echo ""

echo "📊 容器状态:"
ssh ${REMOTE_HOST} "cd ${DEPLOY_DIR} && sudo docker-compose -f docker-compose.arm.yml ps"

echo ""
echo "🔍 统一服务状态:"
ssh ${REMOTE_HOST} "cd ${DEPLOY_DIR} && sudo docker-compose -f docker-compose.arm.yml logs --tail=5 newsscraper"

echo ""
echo "🌐 Web 服务状态:"
ssh ${REMOTE_HOST} "cd ${DEPLOY_DIR} && sudo docker-compose -f docker-compose.arm.yml logs --tail=3 web-quality-tester"

echo ""
echo "========================================"
echo "✅ 合并后部署状态:"
echo "🔗 统一服务: 新闻发现+处理+推送 - 正常运行"  
echo "⚠️  Web服务: 需要额外依赖 - 暂时不可用"
echo ""
echo "📋 访问信息:"
echo "- WordPress目标: http://192.168.1.230:8080"
echo "- Web界面: http://192.168.1.230:3000 (暂时不可用)"
echo ""
echo "🔧 管理命令:"
echo "ssh ${REMOTE_HOST} 'cd ${DEPLOY_DIR} && sudo docker-compose -f docker-compose.arm.yml [ps|logs|restart|down]'"
echo "========================================"
