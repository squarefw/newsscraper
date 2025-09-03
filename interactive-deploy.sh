#!/bin/bash

# 交互式远程部署脚本
# 支持密码登录和密钥认证

set -e

# 配置变量
REMOTE_HOST="${1:-192.168.1.230}"
REMOTE_USER="${2:-root}"
APP_NAME="newsscraper"
DEPLOY_DIR="/opt/${APP_NAME}"

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

# 交互式连接测试
test_connection() {
    echo_info "测试连接到 ${REMOTE_USER}@${REMOTE_HOST}..."
    
    # 尝试连接
    if ssh -o ConnectTimeout=10 -o BatchMode=yes ${REMOTE_USER}@${REMOTE_HOST} "echo '连接成功'" 2>/dev/null; then
        echo_info "SSH 密钥认证成功"
        return 0
    else
        echo_warn "SSH 密钥认证失败，将使用密码认证"
        echo_warn "请在提示时输入服务器密码"
        
        # 测试密码认证
        if ssh -o ConnectTimeout=10 ${REMOTE_USER}@${REMOTE_HOST} "echo '连接成功'" 2>/dev/null; then
            echo_info "密码认证成功"
            return 0
        else
            echo_error "连接失败，请检查："
            echo_error "1. 服务器地址是否正确: ${REMOTE_HOST}"
            echo_error "2. 用户名是否正确: ${REMOTE_USER}"
            echo_error "3. 密码是否正确"
            echo_error "4. 防火墙是否允许 SSH 连接"
            return 1
        fi
    fi
}

# 安装远程依赖
install_remote_deps() {
    echo_info "检查并安装远程依赖..."
    
    ssh ${REMOTE_USER}@${REMOTE_HOST} << 'EOF'
        echo "检查系统信息..."
        uname -a
        
        # 检查并安装 Docker
        if ! command -v docker &> /dev/null; then
            echo "Docker 未安装，开始安装..."
            
            # 检测操作系统
            if [ -f /etc/redhat-release ]; then
                # CentOS/RHEL
                yum update -y
                yum install -y yum-utils device-mapper-persistent-data lvm2
                yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
                yum install -y docker-ce docker-ce-cli containerd.io
            elif [ -f /etc/debian_version ]; then
                # Ubuntu/Debian
                apt-get update
                apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
                curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
                echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
                apt-get update
                apt-get install -y docker-ce docker-ce-cli containerd.io
            else
                # 通用安装方式
                curl -fsSL https://get.docker.com | sh
            fi
            
            systemctl start docker
            systemctl enable docker
            echo "Docker 安装完成"
        else
            echo "Docker 已安装: $(docker --version)"
        fi
        
        # 检查并安装 Docker Compose
        if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
            echo "Docker Compose 未安装，开始安装..."
            curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
            chmod +x /usr/local/bin/docker-compose
            ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
            echo "Docker Compose 安装完成"
        else
            echo "Docker Compose 已安装"
        fi
        
        # 启动 Docker 服务
        if ! systemctl is-active --quiet docker; then
            echo "启动 Docker 服务..."
            systemctl start docker
        fi
        
        echo "依赖检查完成"
EOF
}

# 传输和部署
deploy_app() {
    echo_info "开始传输项目文件..."
    
    # 创建部署包
    echo_info "创建部署包..."
    tar --exclude='.git' \
        --exclude='node_modules' \
        --exclude='logs' \
        --exclude='temp' \
        --exclude='*.tar.gz' \
        --exclude='.DS_Store' \
        --exclude='DEPLOYMENT_GUIDE.md' \
        -czf ${APP_NAME}-deploy.tar.gz .
    
    # 创建远程目录
    ssh ${REMOTE_USER}@${REMOTE_HOST} "mkdir -p ${DEPLOY_DIR}"
    
    # 传输文件
    echo_info "传输文件到远程服务器..."
    scp ${APP_NAME}-deploy.tar.gz ${REMOTE_USER}@${REMOTE_HOST}:${DEPLOY_DIR}/
    
    # 远程部署
    echo_info "在远程服务器上部署..."
    ssh ${REMOTE_USER}@${REMOTE_HOST} << EOF
        cd ${DEPLOY_DIR}
        
        # 解压文件
        echo "解压部署文件..."
        tar -xzf ${APP_NAME}-deploy.tar.gz
        rm ${APP_NAME}-deploy.tar.gz
        
        # 创建必要目录
        mkdir -p logs temp
        
        # 停止现有服务
        echo "停止现有服务..."
        docker-compose down || true
        
        # 清理旧镜像
        echo "清理旧镜像..."
        docker system prune -f || true
        
        # 构建镜像
        echo "构建 Docker 镜像..."
        docker build -t ${APP_NAME}:latest .
        
        if [ \$? -ne 0 ]; then
            echo "ERROR: 镜像构建失败"
            exit 1
        fi
        
        # 启动服务
        echo "启动服务..."
        docker-compose up -d
        
        # 等待服务启动
        sleep 10
        
        # 检查状态
        echo "检查服务状态..."
        docker-compose ps
        
        # 显示日志
        echo "最近日志："
        docker-compose logs --tail=10
        
        echo ""
        echo "部署完成！"
        echo "服务访问地址："
        echo "- Web 界面: http://\$(hostname -I | awk '{print \$1}'):3000"
        echo "- 管理命令: docker-compose [ps|logs|restart|down]"
EOF
    
    # 清理本地文件
    rm ${APP_NAME}-deploy.tar.gz
    
    echo_info "部署完成！"
}

# 显示使用说明
show_usage() {
    echo "使用方法: $0 [hostname] [username]"
    echo ""
    echo "示例:"
    echo "  $0 192.168.1.230 root"
    echo "  $0 192.168.1.230        # 默认使用 root 用户"
    echo "  $0                      # 默认 192.168.1.230 root"
    echo ""
    echo "部署后管理："
    echo "  ssh ${REMOTE_USER}@${REMOTE_HOST} 'cd ${DEPLOY_DIR} && docker-compose logs -f'"
    echo "  ssh ${REMOTE_USER}@${REMOTE_HOST} 'cd ${DEPLOY_DIR} && docker-compose ps'"
}

# 主执行流程
main() {
    echo_info "NewsScraper 交互式部署工具"
    echo_info "目标服务器: ${REMOTE_USER}@${REMOTE_HOST}"
    echo_info "部署目录: ${DEPLOY_DIR}"
    echo ""
    
    # 确认部署
    read -p "确认开始部署？(y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "部署已取消"
        exit 0
    fi
    
    test_connection || exit 1
    install_remote_deps
    deploy_app
    
    echo ""
    echo_info "🎉 部署成功完成！"
    echo_info "Web 界面: http://${REMOTE_HOST}:3000"
}

# 参数处理
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_usage
    exit 0
fi

# 执行主流程
main
