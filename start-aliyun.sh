#!/bin/bash

# 阿里云生产环境快速启动脚本
# 使用方法：
#   ./start-aliyun.sh                    # 正常运行
#   ./start-aliyun.sh --dry-run          # 干运行模式
#   ./start-aliyun.sh --max-articles 5   # 限制文章数量
#   ./start-aliyun.sh --skip-discovery   # 跳过发现阶段

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 显示使用说明
show_usage() {
    echo "阿里云生产环境新闻抓取系统"
    echo ""
    echo "使用方法："
    echo "  $0 [选项]"
    echo ""
    echo "选项："
    echo "  --dry-run              干运行模式，不实际推送到WordPress"
    echo "  --max-articles NUM     最大处理文章数量 (默认: 20)"
    echo "  --skip-discovery       跳过发现阶段，直接处理现有队列"
    echo "  --cleanup              运行完成后清理临时文件 (默认启用)"
    echo "  --no-cleanup           运行完成后保留临时文件"
    echo "  --help                 显示此帮助信息"
    echo ""
    echo "环境变量："
    echo "  DRY_RUN=true          等同于 --dry-run"
    echo "  MAX_ARTICLES=10       等同于 --max-articles 10"
    echo "  SKIP_DISCOVERY=true   等同于 --skip-discovery"
    echo "  CLEANUP=false         等同于 --no-cleanup"
    echo ""
    echo "示例："
    echo "  $0                             # 正常运行"
    echo "  $0 --dry-run                   # 测试运行"
    echo "  $0 --max-articles 5            # 只处理5篇文章"
    echo "  $0 --skip-discovery --dry-run  # 跳过发现，干运行"
}

# 检查Node.js环境
check_nodejs() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装，请先安装 Node.js"
        exit 1
    fi
    
    local node_version=$(node --version)
    print_info "Node.js 版本: $node_version"
}

# 检查项目依赖
check_dependencies() {
    if [ ! -f "package.json" ]; then
        print_error "当前目录不是有效的Node.js项目"
        exit 1
    fi
    
    if [ ! -d "node_modules" ]; then
        print_warning "依赖未安装，正在安装..."
        npm install
    fi
}

# 检查配置文件
check_config() {
    local config_file="config/config.remote-aliyun.json"
    if [ ! -f "$config_file" ]; then
        print_error "阿里云配置文件不存在: $config_file"
        exit 1
    fi
    
    local api_keys_file="config/api-keys.json"
    if [ ! -f "$api_keys_file" ]; then
        print_error "API密钥文件不存在: $api_keys_file"
        print_info "请创建该文件并配置必要的API密钥"
        exit 1
    fi
    
    print_success "配置文件检查通过"
}

# 创建必要目录
create_directories() {
    local dirs=("logs" "temp" "examples")
    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            print_info "创建目录: $dir"
        fi
    done
}

# 显示系统信息
show_system_info() {
    print_info "==== 系统信息 ===="
    print_info "时间: $(date)"
    print_info "用户: $(whoami)"
    print_info "目录: $(pwd)"
    print_info "Node.js: $(node --version)"
    print_info "内存: $(free -h 2>/dev/null | grep '^Mem:' | awk '{print $2}' || echo 'N/A')"
    print_info "磁盘: $(df -h . | tail -1 | awk '{print $4}' | sed 's/^/剩余 /')"
    print_info "=================="
}

# 设置信号处理
setup_signal_handlers() {
    trap 'print_warning "收到中断信号，正在退出..."; exit 130' INT
    trap 'print_warning "收到终止信号，正在退出..."; exit 143' TERM
}

# 解析命令行参数
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                export DRY_RUN=true
                print_info "启用干运行模式"
                shift
                ;;
            --max-articles)
                export MAX_ARTICLES="$2"
                print_info "设置最大文章数量: $2"
                shift 2
                ;;
            --skip-discovery)
                export SKIP_DISCOVERY=true
                print_info "跳过发现阶段"
                shift
                ;;
            --cleanup)
                export CLEANUP=true
                print_info "启用清理模式"
                shift
                ;;
            --no-cleanup)
                export CLEANUP=false
                print_info "禁用清理模式"
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                print_error "未知参数: $1"
                show_usage
                exit 1
                ;;
        esac
    done
}

# 显示运行配置
show_config() {
    print_info "==== 运行配置 ===="
    print_info "干运行模式: ${DRY_RUN:-false}"
    print_info "最大文章数: ${MAX_ARTICLES:-20}"
    print_info "跳过发现: ${SKIP_DISCOVERY:-false}"
    print_info "清理文件: ${CLEANUP:-true}"
    print_info "=================="
}

# 主函数
main() {
    # 设置信号处理
    setup_signal_handlers
    
    # 解析参数
    parse_arguments "$@"
    
    print_success "🚀 启动阿里云生产环境新闻抓取系统"
    echo ""
    
    # 显示系统信息
    show_system_info
    echo ""
    
    # 显示运行配置
    show_config
    echo ""
    
    # 环境检查
    print_info "🔍 检查运行环境..."
    check_nodejs
    check_dependencies
    check_config
    create_directories
    print_success "✅ 环境检查完成"
    echo ""
    
    # 运行主程序
    print_info "🎬 开始执行主程序..."
    local start_time=$(date +%s)
    
    if node run-aliyun-production.js; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_success "🎉 运行成功完成！耗时: ${duration}秒"
        
        # 显示日志文件位置
        if [ -f "logs/aliyun-production.log" ]; then
            print_info "📋 详细日志: logs/aliyun-production.log"
        fi
        
        if [ -f "logs/aliyun-production-report.json" ]; then
            print_info "📊 运行报告: logs/aliyun-production-report.json"
        fi
        
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_error "💥 运行失败！耗时: ${duration}秒"
        
        # 显示错误日志
        if [ -f "logs/aliyun-production.log" ]; then
            print_warning "检查错误日志: logs/aliyun-production.log"
            echo ""
            print_warning "最近的错误信息："
            tail -10 "logs/aliyun-production.log" | grep -E "(ERROR|WARN)" || echo "无错误信息"
        fi
        
        exit 1
    fi
}

# 执行主函数
main "$@"
