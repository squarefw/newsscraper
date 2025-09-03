#!/bin/bash

# NewsScraper 容器化部署脚本
# 用于在 192.168.1.230 服务器上部署应用

set -e

# 配置变量
REMOTE_HOST="192.168.1.230"
REMOTE_USER="root"  # 或者你的用户名
APP_NAME="newsscraper"
DEPLOY_DIR="/opt/${APP_NAME}"
DOCKER_COMPOSE_FILE="docker-compose.yml"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

echo_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查本地环境
check_local_requirements() {
    echo_info "检查本地环境..."
    
    if ! command -v ssh &> /dev/null; then
        echo_error "SSH 客户端未安装"
        exit 1
    fi
    
    if ! command -v scp &> /dev/null; then
        echo_error "SCP 客户端未安装"
        exit 1
    fi
    
    if ! command -v tar &> /dev/null; then
        echo_error "tar 命令未安装"
        exit 1
    fi
    
    echo_info "本地环境检查通过"
}

# 检查远程服务器连接
check_remote_connection() {
    echo_info "检查远程服务器连接..."
    
    if ! ssh -o ConnectTimeout=10 ${REMOTE_USER}@${REMOTE_HOST} "echo '远程连接成功'" &> /dev/null; then
        echo_error "无法连接到远程服务器 ${REMOTE_HOST}"
        echo_error "请确保："
        echo_error "1. 服务器地址正确"
        echo_error "2. SSH 密钥已配置或可以密码登录"
        echo_error "3. 防火墙允许 SSH 连接"
        exit 1
    fi
    
    echo_info "远程服务器连接正常"
}

# 检查远程服务器环境
check_remote_requirements() {
    echo_info "检查远程服务器环境..."
    
    ssh ${REMOTE_USER}@${REMOTE_HOST} << 'EOF'
        # 检查 Docker
        if ! command -v docker &> /dev/null; then
            echo "ERROR: Docker 未安装"
            exit 1
        fi
        
        # 检查 Docker Compose
        if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
            echo "ERROR: Docker Compose 未安装"
            exit 1
        fi
        
        # 检查 Docker 服务状态
        if ! systemctl is-active --quiet docker; then
            echo "ERROR: Docker 服务未运行"
            exit 1
        fi
        
        echo "远程服务器环境检查通过"
EOF
    
    if [ $? -ne 0 ]; then
        echo_error "远程服务器环境检查失败"
        exit 1
    fi
}

# 创建环境配置文件
create_env_file() {
    echo_info "创建环境配置文件..."
    
    if [ ! -f ".env" ]; then
        echo_warn ".env 文件不存在，从模板创建..."
        cp .env.example .env
        echo_warn "请编辑 .env 文件，填入正确的 API 密钥和配置"
        echo_warn "继续部署前请确认配置正确"
        read -p "按 Enter 继续，或 Ctrl+C 取消..."
    fi
}

# 构建 Docker 镜像（在远程服务器上）
build_image_remote() {
    echo_info "在远程服务器上构建 Docker 镜像..."
    
    # 传输项目文件到临时目录
    ssh ${REMOTE_USER}@${REMOTE_HOST} "mkdir -p /tmp/${APP_NAME}-build"
    
    # 创建项目文件压缩包
    echo_info "压缩项目文件..."
    tar --exclude='.git' --exclude='node_modules' --exclude='logs' --exclude='.env' \
        --exclude='*.tar.gz' --exclude='temp' -czf ${APP_NAME}-source.tar.gz .
    
    # 传输到远程服务器
    echo_info "传输项目文件到远程服务器..."
    scp ${APP_NAME}-source.tar.gz ${REMOTE_USER}@${REMOTE_HOST}:/tmp/${APP_NAME}-build/
    
    # 在远程服务器上解压和构建
    ssh ${REMOTE_USER}@${REMOTE_HOST} << EOF
        cd /tmp/${APP_NAME}-build
        tar -xzf ${APP_NAME}-source.tar.gz
        rm ${APP_NAME}-source.tar.gz
        
        echo "在远程服务器上构建 Docker 镜像..."
        docker build -t ${APP_NAME}:latest .
        
        if [ \$? -eq 0 ]; then
            echo "Docker 镜像构建成功"
        else
            echo "Docker 镜像构建失败"
            exit 1
        fi
        
        # 清理构建文件
        cd /
        rm -rf /tmp/${APP_NAME}-build
EOF
    
    # 清理本地文件
    rm ${APP_NAME}-source.tar.gz
    
    if [ $? -eq 0 ]; then
        echo_info "远程镜像构建成功"
    else
        echo_error "远程镜像构建失败"
        exit 1
    fi
}

# 传输项目配置文件
transfer_config_files() {
    echo_info "传输项目配置文件..."
    
    # 创建远程目录
    ssh ${REMOTE_USER}@${REMOTE_HOST} "mkdir -p ${DEPLOY_DIR}"
    
    # 传输必要文件
    scp docker-compose.yml ${REMOTE_USER}@${REMOTE_HOST}:${DEPLOY_DIR}/
    scp nginx.conf ${REMOTE_USER}@${REMOTE_HOST}:${DEPLOY_DIR}/
    
    # 传输配置目录
    scp -r config ${REMOTE_USER}@${REMOTE_HOST}:${DEPLOY_DIR}/
    
    # 传输示例目录
    scp -r examples ${REMOTE_USER}@${REMOTE_HOST}:${DEPLOY_DIR}/
    
    # 传输环境配置文件（如果存在）
    if [ -f ".env" ]; then
        scp .env ${REMOTE_USER}@${REMOTE_HOST}:${DEPLOY_DIR}/
    else
        scp .env.example ${REMOTE_USER}@${REMOTE_HOST}:${DEPLOY_DIR}/.env
        echo_warn "使用 .env.example 作为 .env 文件，请在远程服务器上编辑配置"
    fi
    
    # 创建必要的目录
    ssh ${REMOTE_USER}@${REMOTE_HOST} "mkdir -p ${DEPLOY_DIR}/logs ${DEPLOY_DIR}/temp"
    
    echo_info "配置文件传输完成"
}

# 在远程服务器上部署
deploy_remote() {
    echo_info "在远程服务器上部署应用..."
    
    ssh ${REMOTE_USER}@${REMOTE_HOST} << EOF
        cd ${DEPLOY_DIR}
        
        # 停止现有容器
        echo "停止现有容器..."
        docker-compose down || true
        
        # 清理旧镜像（可选）
        echo "清理旧镜像..."
        docker image prune -f || true
        
        # 启动新容器
        echo "启动新容器..."
        docker-compose up -d
        
        # 等待服务启动
        echo "等待服务启动..."
        sleep 10
        
        # 检查容器状态
        echo "检查容器状态..."
        docker-compose ps
        
        # 检查服务健康状态
        echo "检查服务健康状态..."
        docker-compose logs --tail=20
        
        echo "部署完成！"
EOF
    
    if [ $? -eq 0 ]; then
        echo_info "远程部署成功"
    else
        echo_error "远程部署失败"
        exit 1
    fi
}

# 显示部署信息
show_deployment_info() {
    echo_info "部署信息："
    echo "- 应用名称: ${APP_NAME}"
    echo "- 远程服务器: ${REMOTE_HOST}"
    echo "- 部署目录: ${DEPLOY_DIR}"
    echo "- Web 界面: http://${REMOTE_HOST}:80"
    echo "- 管理命令: ssh ${REMOTE_USER}@${REMOTE_HOST} 'cd ${DEPLOY_DIR} && docker-compose logs -f'"
}

# 主执行流程
main() {
    echo_info "开始 NewsScraper 容器化部署..."
    
    check_local_requirements
    check_remote_connection
    check_remote_requirements
    create_env_file
    build_image_remote
    transfer_config_files
    deploy_remote
    show_deployment_info
    
    echo_info "部署完成！"
}

# 脚本参数处理
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "build")
        build_image_remote
        ;;
    "check")
        check_local_requirements
        check_remote_connection
        check_remote_requirements
        ;;
    "logs")
        ssh ${REMOTE_USER}@${REMOTE_HOST} "cd ${DEPLOY_DIR} && docker-compose logs -f"
        ;;
    "status")
        ssh ${REMOTE_USER}@${REMOTE_HOST} "cd ${DEPLOY_DIR} && docker-compose ps"
        ;;
    "stop")
        ssh ${REMOTE_USER}@${REMOTE_HOST} "cd ${DEPLOY_DIR} && docker-compose down"
        ;;
    "restart")
        ssh ${REMOTE_USER}@${REMOTE_HOST} "cd ${DEPLOY_DIR} && docker-compose restart"
        ;;
    *)
        echo "使用方法: $0 [deploy|build|check|logs|status|stop|restart]"
        echo "  deploy  - 完整部署 (默认)"
        echo "  build   - 仅构建镜像"
        echo "  check   - 检查环境"
        echo "  logs    - 查看日志"
        echo "  status  - 查看状态"
        echo "  stop    - 停止服务"
        echo "  restart - 重启服务"
        exit 1
        ;;
esac
