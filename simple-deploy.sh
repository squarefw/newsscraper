#!/bin/bash

# 简化的远程部署脚本 - 无需本地 Docker
# 使用方法: ./simple-deploy.sh [username@]hostname

set -e

# 配置变量
REMOTE_HOST="${1:-root@192.168.1.230}"
APP_NAME="newsscraper"
DEPLOY_DIR="${HOME}/${APP_NAME}"  # 使用用户主目录避免权限问题

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# 检查远程连接
check_connection() {
    echo_info "检查远程服务器连接: ${REMOTE_HOST}"
    
    if ! ssh -o ConnectTimeout=10 ${REMOTE_HOST} "echo '连接成功'" &> /dev/null; then
        echo_error "无法连接到远程服务器 ${REMOTE_HOST}"
        echo_error "请确保 SSH 密钥已配置或可以密码登录"
        exit 1
    fi
    
    echo_info "远程服务器连接正常"
}

# 检查远程 Docker 环境
check_remote_docker() {
    echo_info "检查远程 Docker 环境..."
    
    ssh ${REMOTE_HOST} << 'EOF'
        if ! command -v docker &> /dev/null; then
            echo "ERROR: Docker 未安装，尝试使用包管理器安装..."
            
            # 检测系统类型并安装
            if command -v apt-get &> /dev/null; then
                # Debian/Ubuntu 系统
                sudo apt-get update
                sudo apt-get install -y docker.io docker-compose
                sudo systemctl start docker
                sudo systemctl enable docker
                # 将当前用户添加到 docker 组
                sudo usermod -aG docker $USER
                echo "Docker 安装完成，请重新登录以获得 docker 权限"
            elif command -v yum &> /dev/null; then
                # CentOS/RHEL 系统
                sudo yum install -y docker docker-compose
                sudo systemctl start docker
                sudo systemctl enable docker
                sudo usermod -aG docker $USER
            else
                echo "ERROR: 无法自动安装 Docker，请手动安装"
                exit 1
            fi
        else
            echo "Docker 已安装: $(docker --version 2>/dev/null || echo 'Docker 存在但可能需要权限')"
        fi
        
        if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null 2>&1; then
            echo "ERROR: Docker Compose 未安装，正在安装..."
            if command -v apt-get &> /dev/null; then
                sudo apt-get install -y docker-compose
            elif ! command -v docker-compose &> /dev/null; then
                # 手动安装 docker-compose
                sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
                sudo chmod +x /usr/local/bin/docker-compose
            fi
        fi
        
        # 检查 Docker 服务状态
        if ! sudo systemctl is-active --quiet docker 2>/dev/null; then
            echo "启动 Docker 服务..."
            sudo systemctl start docker || echo "无法启动 Docker 服务，可能需要手动处理"
        fi
        
        # 测试 Docker 访问权限
        if docker ps &>/dev/null; then
            echo "Docker 权限正常"
        else
            echo "Docker 需要 sudo 权限，将在命令前添加 sudo"
        fi
        
        echo "Docker 环境检查完成"
EOF
}

# 传输项目文件
transfer_files() {
    echo_info "传输项目文件到远程服务器..."
    
    # 创建项目压缩包（排除不需要的文件）
    echo_info "打包项目文件..."
    tar --exclude='.git' \
        --exclude='node_modules' \
        --exclude='logs' \
        --exclude='temp' \
        --exclude='*.tar.gz' \
        --exclude='.DS_Store' \
        -czf ${APP_NAME}-deploy.tar.gz .
    
    # 获取远程用户主目录并创建部署目录
    REMOTE_HOME=$(ssh ${REMOTE_HOST} "echo \$HOME")
    DEPLOY_DIR="${REMOTE_HOME}/${APP_NAME}"
    
    echo_info "部署目录: ${DEPLOY_DIR}"
    
    ssh ${REMOTE_HOST} "mkdir -p ${DEPLOY_DIR}"
    scp ${APP_NAME}-deploy.tar.gz ${REMOTE_HOST}:${DEPLOY_DIR}/
    
    # 在远程服务器上解压
    ssh ${REMOTE_HOST} << EOF
        cd ${DEPLOY_DIR}
        tar -xzf ${APP_NAME}-deploy.tar.gz
        rm ${APP_NAME}-deploy.tar.gz
        
        # 创建必要的目录
        mkdir -p logs temp
        
        # 设置权限
        chmod +x deploy.sh || true
        chmod +x simple-deploy.sh || true
        chmod +x interactive-deploy.sh || true
        
        echo "项目文件传输完成"
EOF
    
    # 清理本地文件
    rm ${APP_NAME}-deploy.tar.gz
    
    echo_info "文件传输完成"
}

# 远程构建和部署
deploy_remote() {
    echo_info "在远程服务器上构建和部署..."
    
    # 获取远程用户主目录
    REMOTE_HOME=$(ssh ${REMOTE_HOST} "echo \$HOME")
    DEPLOY_DIR="${REMOTE_HOME}/${APP_NAME}"
    
    ssh ${REMOTE_HOST} << EOF
        cd ${DEPLOY_DIR}
        
        # 检测系统架构
        ARCH=\$(uname -m)
        if [ "\$ARCH" = "aarch64" ] || [ "\$ARCH" = "arm64" ]; then
            echo "检测到 ARM64 架构，使用优化的配置"
            COMPOSE_FILE="docker-compose.arm.yml"
            if [ ! -f "\$COMPOSE_FILE" ]; then
                echo "使用默认 docker-compose.yml"
                COMPOSE_FILE="docker-compose.yml"
            fi
        else
            echo "检测到 x64 架构"
            COMPOSE_FILE="docker-compose.yml"
        fi
        
        # 检查 Docker 权限
        if docker ps &>/dev/null; then
            DOCKER_CMD="docker"
            COMPOSE_CMD="docker-compose -f \$COMPOSE_FILE"
        else
            echo "使用 sudo 权限运行 Docker 命令"
            DOCKER_CMD="sudo docker"
            COMPOSE_CMD="sudo docker-compose -f \$COMPOSE_FILE"
        fi
        
        # 停止现有容器
        echo "停止现有容器..."
        \$COMPOSE_CMD down || true
        
        # 清理旧镜像
        echo "清理旧镜像..."
        \$DOCKER_CMD image prune -f || true
        
        # 构建新镜像
        echo "构建 Docker 镜像..."
        \$DOCKER_CMD build -t ${APP_NAME}:latest .
        
        if [ \$? -ne 0 ]; then
            echo "ERROR: Docker 镜像构建失败"
            exit 1
        fi
        
        # 启动服务
        echo "启动服务..."
        \$COMPOSE_CMD up -d
        
        # 等待服务启动
        sleep 10
        
        # 检查服务状态
        echo "检查服务状态..."
        \$COMPOSE_CMD ps
        
        # 显示简要日志
        echo "最近日志："
        \$COMPOSE_CMD logs --tail=5
        
        echo "部署完成！"
        echo "Web 界面访问地址: http://\$(hostname -I | awk '{print \$1}'):3000"
EOF
    
    if [ $? -eq 0 ]; then
        echo_info "部署成功！"
    else
        echo_error "部署失败"
        exit 1
    fi
}

# 显示使用信息
show_usage() {
    echo "使用方法: $0 [username@]hostname"
    echo "示例:"
    echo "  $0 root@192.168.1.230"
    echo "  $0 192.168.1.230          # 使用当前用户"
    echo ""
    echo "部署后管理命令:"
    echo "  ssh ${REMOTE_HOST} 'cd ${DEPLOY_DIR} && docker-compose logs -f'     # 查看日志"
    echo "  ssh ${REMOTE_HOST} 'cd ${DEPLOY_DIR} && docker-compose ps'          # 查看状态"
    echo "  ssh ${REMOTE_HOST} 'cd ${DEPLOY_DIR} && docker-compose restart'     # 重启服务"
    echo "  ssh ${REMOTE_HOST} 'cd ${DEPLOY_DIR} && docker-compose down'        # 停止服务"
}

# 主执行流程
main() {
    echo_info "开始简化部署流程..."
    
    check_connection
    check_remote_docker
    transfer_files
    deploy_remote
    
    echo_info "部署完成！"
    echo_info "Web 界面地址: http://${REMOTE_HOST#*@}:3000"
}

# 检查参数
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_usage
    exit 0
fi

if [ -z "$1" ]; then
    echo_warn "使用默认服务器: root@192.168.1.230"
    echo_warn "如需指定其他服务器，请使用: $0 username@hostname"
fi

# 执行主流程
main
