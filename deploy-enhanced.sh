#!/bin/bash

# 部署增强版Puppeteer解析器到远程服务器
# 基于现有的deploy.sh，针对高级反检测功能优化

set -e

# 配置变量 - 使用与simple-deploy.sh相同的配置
REMOTE_HOST="${1:-weifang@192.168.1.230}"
APP_NAME="newsscraper"
# 使用用户主目录避免权限问题
REMOTE_HOME=""
DEPLOY_DIR=""

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

echo_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 获取远程目录信息
get_remote_dirs() {
    REMOTE_HOME=$(ssh ${REMOTE_HOST} "echo \$HOME")
    DEPLOY_DIR="${REMOTE_HOME}/${APP_NAME}"
    echo_info "远程主目录: ${REMOTE_HOME}"
    echo_info "部署目录: ${DEPLOY_DIR}"
}

# 检查远程连接和获取目录信息
check_remote_connection() {
    echo_step "检查远程连接: ${REMOTE_HOST}"
    
    if ! ssh -o ConnectTimeout=10 ${REMOTE_HOST} "echo '连接成功'" &> /dev/null; then
        echo_error "无法连接到远程服务器 ${REMOTE_HOST}"
        echo_error "请确保 SSH 密钥已配置或可以密码登录"
        exit 1
    fi
    
    get_remote_dirs
    echo_info "远程服务器连接正常"
}
# 检查增强版文件是否存在
check_enhanced_files() {
    echo_step "检查增强版文件..."
    
    local files=(
        "utils/puppeteerResolver_enhanced.js"
        "temp/docker-test.js"
        "Dockerfile"
        "docker-compose.arm.yml"
    )
    
    for file in "${files[@]}"; do
        if [ ! -f "$file" ]; then
            echo_error "缺少必要文件: $file"
            exit 1
        fi
    done
    
    echo_info "所有增强版文件检查通过"
}

# 创建快速部署包
create_deploy_package() {
    echo_step "创建增强版部署包..."
    
    # 创建临时目录
    mkdir -p temp/deploy-package
    
    # 复制核心文件
    echo_info "复制核心增强文件..."
    cp utils/puppeteerResolver_enhanced.js temp/deploy-package/
    cp temp/docker-test.js temp/deploy-package/
    cp Dockerfile temp/deploy-package/
    cp docker-compose.arm.yml temp/deploy-package/
    
    # 创建部署清单
    cat > temp/deploy-package/DEPLOY_MANIFEST.txt << EOF
增强版Puppeteer解析器部署清单
================================
部署时间: $(date)
核心文件:
- puppeteerResolver_enhanced.js (高级反检测解析器)
- docker-test.js (Docker环境测试脚本)
- Dockerfile (优化的容器配置)
- docker-compose.arm.yml (ARM优化的compose配置)

主要增强功能:
1. 高级浏览器指纹伪装
2. Google consent页面自动处理
3. 反自动化检测技术
4. Docker环境优化配置
EOF
    
    echo_info "部署包创建完成"
}

# 备份远程现有文件
backup_remote_files() {
    echo_step "备份远程现有文件..."
    
    ssh ${REMOTE_HOST} << EOF
        cd ${DEPLOY_DIR}
        
        # 创建备份目录
        mkdir -p backups/\$(date +%Y%m%d_%H%M%S)
        BACKUP_DIR="backups/\$(date +%Y%m%d_%H%M%S)"
        
        # 备份关键文件
        if [ -f "utils/puppeteerResolver_enhanced.js" ]; then
            cp utils/puppeteerResolver_enhanced.js \$BACKUP_DIR/
            echo "已备份: puppeteerResolver_enhanced.js"
        fi
        
        if [ -f "Dockerfile" ]; then
            cp Dockerfile \$BACKUP_DIR/
            echo "已备份: Dockerfile"
        fi
        
        if [ -f "docker-compose.arm.yml" ]; then
            cp docker-compose.arm.yml \$BACKUP_DIR/
            echo "已备份: docker-compose.arm.yml"
        fi
        
        echo "备份完成: \$BACKUP_DIR"
EOF
    
    echo_info "远程文件备份完成"
}

# 部署增强版文件
deploy_enhanced_files() {
    echo_step "部署增强版文件到远程服务器..."
    
    # 确保远程目录存在
    ssh ${REMOTE_HOST} "mkdir -p ${DEPLOY_DIR}/utils ${DEPLOY_DIR}/temp"
    
    # 传输核心增强文件
    echo_info "传输增强版解析器..."
    scp utils/puppeteerResolver_enhanced.js ${REMOTE_HOST}:${DEPLOY_DIR}/utils/
    
    echo_info "传输Docker测试脚本..."
    scp temp/docker-test.js ${REMOTE_HOST}:${DEPLOY_DIR}/temp/
    
    echo_info "传输Docker配置文件..."
    scp Dockerfile ${REMOTE_HOST}:${DEPLOY_DIR}/
    scp docker-compose.arm.yml ${REMOTE_HOST}:${DEPLOY_DIR}/
    
    echo_info "文件传输完成"
}

# 重建Docker镜像
rebuild_docker_image() {
    echo_step "重建Docker镜像..."
    
    ssh ${REMOTE_HOST} << EOF
        cd ${DEPLOY_DIR}
        
        # 检查 Docker 权限
        if docker ps &>/dev/null; then
            DOCKER_CMD="docker"
            COMPOSE_CMD="docker-compose -f docker-compose.arm.yml"
        else
            echo "使用 sudo 权限运行 Docker 命令"
            DOCKER_CMD="sudo docker"
            COMPOSE_CMD="sudo docker-compose -f docker-compose.arm.yml"
        fi
        
        echo "停止现有容器..."
        \$COMPOSE_CMD down || true
        
        echo "删除旧镜像..."
        \$DOCKER_CMD rmi ${APP_NAME}:latest || true
        
        echo "构建新的增强版镜像..."
        \$DOCKER_CMD build -t ${APP_NAME}:latest .
        
        if [ \$? -eq 0 ]; then
            echo "✅ Docker镜像构建成功"
        else
            echo "❌ Docker镜像构建失败"
            exit 1
        fi
EOF
    
    if [ $? -ne 0 ]; then
        echo_error "Docker镜像构建失败"
        exit 1
    fi
    
    echo_info "Docker镜像重建完成"
}

# 启动增强版服务
start_enhanced_service() {
    echo_step "启动增强版服务..."
    
    ssh ${REMOTE_HOST} << EOF
        cd ${DEPLOY_DIR}
        
        # 检查 Docker 权限
        if docker ps &>/dev/null; then
            COMPOSE_CMD="docker-compose -f docker-compose.arm.yml"
        else
            COMPOSE_CMD="sudo docker-compose -f docker-compose.arm.yml"
        fi
        
        echo "使用ARM优化配置启动服务..."
        \$COMPOSE_CMD up -d
        
        echo "等待服务启动..."
        sleep 15
        
        echo "检查容器状态..."
        \$COMPOSE_CMD ps
        
        echo "检查服务日志..."
        \$COMPOSE_CMD logs --tail=10
EOF
    
    echo_info "增强版服务启动完成"
}

# 运行Docker环境测试
run_docker_test() {
    echo_step "运行Docker环境完整测试..."
    
    ssh ${REMOTE_HOST} << EOF
        cd ${DEPLOY_DIR}
        
        # 检查 Docker 权限
        if docker ps &>/dev/null; then
            DOCKER_CMD="docker"
            COMPOSE_CMD="docker-compose -f docker-compose.arm.yml"
        else
            DOCKER_CMD="sudo docker"
            COMPOSE_CMD="sudo docker-compose -f docker-compose.arm.yml"
        fi
        
        echo "=================================="
        echo "🐳 开始Docker环境完整测试"
        echo "=================================="
        
        # 在容器内运行测试
        \$DOCKER_CMD exec newsscraper-unified node temp/docker-test.js
        
        echo "=================================="
        echo "📊 测试结果分析"
        echo "=================================="
        
        # 检查测试结果
        if [ \$? -eq 0 ]; then
            echo "✅ Docker环境测试成功!"
            echo "🎉 增强版Puppeteer解析器在远程Docker环境中正常工作!"
        else
            echo "❌ Docker环境测试失败"
            echo "📋 查看详细日志..."
            \$COMPOSE_CMD logs --tail=20 newsscraper
        fi
EOF
    
    local test_result=$?
    
    if [ $test_result -eq 0 ]; then
        echo_info "✅ 远程Docker测试成功!"
    else
        echo_warn "⚠️ 远程Docker测试遇到问题，请查看日志"
    fi
    
    return $test_result
}

# 显示部署后状态
show_deployment_status() {
    echo_step "显示部署状态..."
    
    ssh ${REMOTE_HOST} << EOF
        cd ${DEPLOY_DIR}
        
        # 检查 Docker 权限
        if docker ps &>/dev/null; then
            DOCKER_CMD="docker"
            COMPOSE_CMD="docker-compose -f docker-compose.arm.yml"
        else
            DOCKER_CMD="sudo docker"
            COMPOSE_CMD="sudo docker-compose -f docker-compose.arm.yml"
        fi
        
        echo "=================================="
        echo "📊 增强版NewsScraper部署状态"
        echo "=================================="
        
        echo "🐳 容器状态:"
        \$COMPOSE_CMD ps
        
        echo ""
        echo "💾 镜像信息:"
        \$DOCKER_CMD images | grep ${APP_NAME}
        
        echo ""
        echo "📋 系统资源:"
        \$DOCKER_CMD stats --no-stream newsscraper-unified || echo "容器未运行"
        
        echo ""
        echo "🔧 管理命令:"
        echo "- 查看日志: ssh ${REMOTE_HOST} 'cd ${DEPLOY_DIR} && \$COMPOSE_CMD logs -f'"
        echo "- 重启服务: ssh ${REMOTE_HOST} 'cd ${DEPLOY_DIR} && \$COMPOSE_CMD restart'"
        echo "- 运行测试: ssh ${REMOTE_HOST} 'cd ${DEPLOY_DIR} && \$DOCKER_CMD exec newsscraper-unified node temp/docker-test.js'"
        echo "- 进入容器: ssh ${REMOTE_HOST} '\$DOCKER_CMD exec -it newsscraper-unified /bin/sh'"
EOF
}

# 主执行流程
main() {
    echo_info "🚀 开始部署增强版Puppeteer解析器到远程服务器..."
    echo_info "目标服务器: ${REMOTE_HOST}"
    echo ""
    
    # 执行部署步骤
    check_remote_connection
    check_enhanced_files
    create_deploy_package
    backup_remote_files
    deploy_enhanced_files
    rebuild_docker_image
    start_enhanced_service
    
    echo ""
    echo_info "⏱️ 等待5秒后开始测试..."
    sleep 5
    
    # 运行测试
    if run_docker_test; then
        echo ""
        echo_info "🎉 增强版部署和测试完全成功!"
        echo_info "✅ 高级反检测Puppeteer解析器已在远程Docker环境中正常工作"
    else
        echo ""
        echo_warn "⚠️ 部署完成但测试遇到问题"
        echo_warn "建议检查日志和配置"
    fi
    
    show_deployment_status
    
    # 清理临时文件
    rm -rf temp/deploy-package
    
    echo ""
    echo_info "📋 部署摘要:"
    echo "   - 服务器: ${REMOTE_HOST}"
    echo "   - 应用目录: ${DEPLOY_DIR}"
    echo "   - 容器名称: newsscraper-unified"
    echo "   - 配置文件: docker-compose.arm.yml"
    echo ""
    echo_info "部署完成!"
}

# 脚本参数处理
# 第一个参数可能是主机名或操作
if [[ "$1" == *"@"* ]] || [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    # 第一个参数是主机名
    REMOTE_HOST="$1"
    OPERATION="${2:-deploy}"
else
    # 第一个参数是操作，使用默认主机
    OPERATION="${1:-deploy}"
fi

case "${OPERATION}" in
    "deploy")
        main
        ;;
    "test")
        echo_info "仅运行远程测试..."
        check_remote_connection
        run_docker_test
        ;;
    "status")
        check_remote_connection
        show_deployment_status
        ;;
    "logs")
        check_remote_connection
        ssh ${REMOTE_HOST} "cd ${DEPLOY_DIR} && \$COMPOSE_CMD logs -f"
        ;;
    *)
        echo "增强版部署脚本使用方法:"
        echo "  $0 [主机名] [操作]"
        echo "  $0 weifang@192.168.1.230 deploy"
        echo "  $0 deploy  # 使用默认主机"
        echo ""
        echo "操作选项:"
        echo "  deploy  - 完整部署增强版 (默认)"
        echo "  test    - 仅运行远程测试"
        echo "  status  - 查看部署状态"
        echo "  logs    - 查看服务日志"
        exit 1
        ;;
esac
