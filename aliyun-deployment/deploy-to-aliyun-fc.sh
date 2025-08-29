#!/bin/bash

# 新闻爬虫阿里云FC自动化部署脚本
# 使用方法: ./deploy-to-aliyun-fc.sh

set -e  # 遇到错误立即退出

# 计算脚本和仓库根目录（在任何cd之前计算以保持正确）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

# 检查命令是否存在
check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 未安装，请先安装 $1"
        exit 1
    fi
}

# 检查文件是否存在
check_file() {
    if [ ! -f "$1" ]; then
        log_error "文件不存在: $1"
        exit 1
    fi
}

# 读取用户输入
read_input() {
    local prompt="$1"
    local default="$2"
    local input

    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " input
        input="${input:-$default}"
    else
        read -p "$prompt: " input
        while [ -z "$input" ]; do
            read -p "$prompt: " input
        done
    fi

    echo "$input"
}

# 主函数
main() {
    log_info "🚀 开始阿里云FC自动化部署..."

    # 检查必要命令
    log_info "📋 检查环境依赖..."
    check_command "node"
    check_command "npm"
    check_command "curl"

    # 检查部署包
    DEPLOY_PACKAGE="newsscraper-fc-no-limit-20250826-224052.zip"
    if [ ! -f "$DEPLOY_PACKAGE" ]; then
        log_error "部署包不存在: $DEPLOY_PACKAGE"
        log_info "请确保部署包在当前目录中"
        exit 1
    fi

    # 检查Serverless Devs
    if ! command -v s &> /dev/null; then
        log_info "📦 安装Serverless Devs..."
        npm install -g @serverless-devs/s
        log_success "Serverless Devs安装完成"
    fi

    # 配置阿里云凭证
    log_info "🔑 配置阿里云凭证..."
    if ! s config get | grep -q "default"; then
        log_warn "未检测到阿里云凭证配置，开始配置..."

        echo ""
        echo "请准备以下信息："
        echo "1. 阿里云AccessKey ID"
        echo "2. 阿里云AccessKey Secret"
        echo "3. 部署区域 (如: cn-hangzhou)"
        echo ""

        s config add
        log_success "阿里云凭证配置完成"
    else
        log_info "检测到已配置的阿里云凭证"
    fi

    # 验证阿里云连接（使用临时默认 region eu-west-1，如果需要会在后续提示中修改）
    log_info "🔍 验证阿里云连接..."
    # 尝试使用 eu-west-1 检查（若未配置或不可用，会在后续通过交互指定）
    if ! s cli fc-api listServices --region eu-west-1 &> /dev/null; then
        log_warn "警告：无法使用 eu-west-1 验证阿里云连接，后续会提示修改部署区域或检查凭证"
    else
        log_success "阿里云连接（eu-west-1）验证成功"
    fi

    # 解压部署包
    DEPLOY_DIR="fc-deploy-$(date +%Y%m%d-%H%M%S)"
    log_info "📦 解压部署包到: $DEPLOY_DIR"
    mkdir -p "$DEPLOY_DIR"
    unzip "$DEPLOY_PACKAGE" -d "$DEPLOY_DIR"
    cd "$DEPLOY_DIR"
    log_success "部署包解压完成"

    # 配置参数
    log_info "⚙️ 配置项目参数..."

    # API密钥配置
    # 首先决定源密钥文件（优先 repo 中的 api-keys.json，其次回退到本地 api-keys.local.json）
    SOURCE_KEY_FILE="$REPO_ROOT/config/api-keys.json"
    if [ ! -f "$SOURCE_KEY_FILE" ]; then
        if [ -f "$REPO_ROOT/config/api-keys.local.json" ]; then
            SOURCE_KEY_FILE="$REPO_ROOT/config/api-keys.local.json"
            log_warn "未找到 config/api-keys.json，准备使用本地密钥文件作为源: $SOURCE_KEY_FILE"
        else
            log_error "API密钥源文件不存在 (期望: config/api-keys.json 或 config/api-keys.local.json)"
            exit 1
        fi
    fi

    echo ""
    log_warn "将把 API 密钥注入到部署包中（不会修改仓库根的文件）。"

    # 将源密钥文件复制到解压后的部署目录内的 ./config/api-keys.json
    if [ -d "./config" ]; then
        cp "$SOURCE_KEY_FILE" "./config/api-keys.json"
    else
        mkdir -p ./config
        cp "$SOURCE_KEY_FILE" "./config/api-keys.json"
    fi

    DEPLOY_KEY_FILE="$PWD/config/api-keys.json"
    log_info "源 API key 文件: $SOURCE_KEY_FILE"
    log_info "已将 API key 文件复制到部署目录: $DEPLOY_KEY_FILE"

    # 确保部署包内包含必要的 utils 源（例如 sourceAnalyzer_new），如果缺失则从仓库根复制
    if [ ! -d "./utils" ]; then
        mkdir -p ./utils
    fi
    for f in "$REPO_ROOT"/utils/sourceAnalyzer_*.js; do
        if [ -f "$f" ]; then
            base=$(basename "$f")
            if [ ! -f "./utils/$base" ]; then
                cp "$f" "./utils/$base"
                log_info "已将缺失的 utils 文件复制到部署目录: ./utils/$base"
            fi
        fi
    done

    # 使用 node 读取 JSON 并列出 ai 下的 provider 名称（如果有）
    AI_PROVIDERS=$(node -e 'const f=process.argv[1]; const fs=require("fs"); try{const j=JSON.parse(fs.readFileSync(f)); const ai=j.ai||{}; const keys=Object.keys(ai); if(keys.length===0){console.log("(none)");} else {console.log(keys.join(", "));}}catch(e){console.log("(unknown)")}' "$DEPLOY_KEY_FILE" 2>/dev/null || echo "(unknown)")

    echo "支持的AI服务: $AI_PROVIDERS"
    echo ""

    # 询问是否需要在部署包内修改 API 密钥
    CONFIG_API=$(read_input "是否需要在部署包内替换/设置 API 密钥? (y/n)" "y")
    if [ "$CONFIG_API" = "y" ] || [ "$CONFIG_API" = "Y" ]; then
        # OpenAI配置
        OPENAI_KEY=$(read_input "OpenAI API Key (留空跳过)" "")
        if [ -n "$OPENAI_KEY" ]; then
            sed -i.bak "s/\"apiKey\": \"YOUR_OPENAI_API_KEY\"/\"apiKey\": \"$OPENAI_KEY\"/" "$DEPLOY_KEY_FILE"
        fi

        # DeepSeek配置
        DEEPSEEK_KEY=$(read_input "DeepSeek API Key (留空跳过)" "")
        if [ -n "$DEEPSEEK_KEY" ]; then
            sed -i.bak "s/\"apiKey\": \"YOUR_DEEPSEEK_API_KEY\"/\"apiKey\": \"$DEEPSEEK_KEY\"/" "$DEPLOY_KEY_FILE"
        fi

        # Anthropic配置
        ANTHROPIC_KEY=$(read_input "Anthropic API Key (留空跳过)" "")
        if [ -n "$ANTHROPIC_KEY" ]; then
            sed -i.bak "s/\"apiKey\": \"YOUR_ANTHROPIC_API_KEY\"/\"apiKey\": \"$ANTHROPIC_KEY\"/" "$DEPLOY_KEY_FILE"
        fi

        log_success "部署包内的 API 密钥已更新"
    fi

    # WordPress配置
    echo ""
    log_warn "请配置WordPress连接信息 ($REPO_ROOT/config/config.remote-aliyun.json):"

    WP_URL=$(read_input "WordPress站点URL" "")
    if [ -n "$WP_URL" ]; then
        sed -i.bak "s|\"url\": \"https://your-wordpress-site.com\"|\"url\": \"$WP_URL\"|" "$REPO_ROOT/config/config.remote-aliyun.json"
    fi

    WP_USERNAME=$(read_input "WordPress用户名" "")
    if [ -n "$WP_USERNAME" ]; then
        sed -i.bak "s/\"username\": \"your-username\"/\"username\": \"$WP_USERNAME\"/" "$REPO_ROOT/config/config.remote-aliyun.json"
    fi

    WP_PASSWORD=$(read_input "WordPress密码" "")
    if [ -n "$WP_PASSWORD" ]; then
        sed -i.bak "s/\"password\": \"your-password\"/\"password\": \"$WP_PASSWORD\"/" "$REPO_ROOT/config/config.remote-aliyun.json"
    fi

    # AI提供商配置
    AI_PROVIDER=$(read_input "AI提供商 (openai/deepseek/anthropic)" "openai")
    sed -i.bak "s/\"provider\": \"openai\"/\"provider\": \"$AI_PROVIDER\"/" "$REPO_ROOT/config/config.remote-aliyun.json"

    log_success "WordPress和AI配置完成"

    # RSS源配置
    echo ""
    log_warn "配置RSS源 ($REPO_ROOT/config/targets.json):"
    echo "当前支持: Google News"
    echo "你可以稍后手动编辑此文件添加更多源"

    # 部署配置
    echo ""
    log_info "🏗️ 部署配置..."

    # 询问部署参数
    SERVICE_NAME=$(read_input "服务名称" "newsscraper-service")
    FUNCTION_NAME=$(read_input "函数名称" "newsscraper-function")
    REGION=$(read_input "部署区域" "eu-west-1")
    MEMORY_SIZE=$(read_input "内存大小(MB)" "512")
    TIMEOUT=$(read_input "超时时间(秒)" "900")

    # 更新s.yaml配置
    sed -i.bak "s/name: newsscraper-service/name: $SERVICE_NAME/" s.yaml
    sed -i.bak "s/functionName: newsscraper-function/functionName: $FUNCTION_NAME/" s.yaml
    sed -i.bak "s/region: cn-hangzhou/region: $REGION/" s.yaml
    sed -i.bak "s/memorySize: 512/memorySize: $MEMORY_SIZE/" s.yaml
    sed -i.bak "s/timeout: 900/timeout: $TIMEOUT/" s.yaml

    log_success "部署配置完成"

    # 安装依赖
    log_info "📦 安装项目依赖..."
    npm install --production
    log_success "依赖安装完成"

    # 本地测试
    echo ""
    TEST_LOCAL=$(read_input "是否进行本地测试? (y/n)" "y")
    if [ "$TEST_LOCAL" = "y" ] || [ "$TEST_LOCAL" = "Y" ]; then
        log_info "🧪 进行本地测试..."
        node test-local.js
        log_success "本地测试完成"
    fi

    # 部署到阿里云
    echo ""
    log_info "🚀 开始部署到阿里云FC..."
    s deploy

    # 获取部署结果
    DEPLOY_RESULT=$(s deploy 2>&1 | grep -E "(Service:|Function:|Trigger:|Endpoint:)" | tail -1)

    if echo "$DEPLOY_RESULT" | grep -q "Endpoint:"; then
        FC_ENDPOINT=$(echo "$DEPLOY_RESULT" | sed 's/.*Endpoint: //')
        log_success "🎉 部署成功!"
        echo ""
        echo "📋 部署信息:"
        echo "服务名称: $SERVICE_NAME"
        echo "函数名称: $FUNCTION_NAME"
        echo "部署区域: $REGION"
        echo "HTTP端点: $FC_ENDPOINT"
        echo ""

        # 保存部署信息
        cat > deploy-info.txt << EOF
阿里云FC部署信息
================
部署时间: $(date)
服务名称: $SERVICE_NAME
函数名称: $FUNCTION_NAME
部署区域: $REGION
HTTP端点: $FC_ENDPOINT
内存大小: ${MEMORY_SIZE}MB
超时时间: ${TIMEOUT}秒

测试命令:
curl -X POST "$FC_ENDPOINT" \\
  -H "Content-Type: application/json" \\
  -d '{"mode":"full","maxArticles":2,"dryRun":true}'
EOF

        log_info "部署信息已保存到: deploy-info.txt"

        # 测试部署
        echo ""
        TEST_DEPLOY=$(read_input "是否测试部署的函数? (y/n)" "y")
        if [ "$TEST_DEPLOY" = "y" ] || [ "$TEST_DEPLOY" = "Y" ]; then
            log_info "🧪 测试部署的函数..."

            # 测试发现阶段
            log_info "测试发现阶段..."
            curl -X POST "$FC_ENDPOINT" \
              -H "Content-Type: application/json" \
              -d '{"mode":"discover","dryRun":true}' \
              --max-time 30

            echo ""
            echo ""

            # 测试完整流程
            log_info "测试完整流程..."
            curl -X POST "$FC_ENDPOINT" \
              -H "Content-Type: application/json" \
              -d '{"mode":"full","maxArticles":1,"dryRun":true}' \
              --max-time 60

            log_success "函数测试完成"
        fi

        # 配置定时触发器
        echo ""
        SETUP_TIMER=$(read_input "是否配置定时触发器? (y/n)" "n")
        if [ "$SETUP_TIMER" = "y" ] || [ "$SETUP_TIMER" = "Y" ]; then
            log_info "⏰ 配置定时触发器..."

            CRON_EXPRESSION=$(read_input "Cron表达式 (默认: 每天8点和20点)" "0 0 8,20 * * *")
            TIMER_PAYLOAD=$(read_input "定时任务参数" '{"mode":"full","maxArticles":10,"dryRun":false}')

            # 添加定时触发器到s.yaml
            cat >> s.yaml << EOF

  - triggerName: timerTrigger
    triggerType: timer
    qualifier: LATEST
    triggerConfig:
      cronExpression: "$CRON_EXPRESSION"
      enable: true
      payload: |
        $TIMER_PAYLOAD
EOF

            log_info "重新部署以应用定时触发器..."
            s deploy

            log_success "定时触发器配置完成"
            echo "定时任务将在 $CRON_EXPRESSION 执行"
        fi

        # 显示使用说明
        echo ""
        echo "🎯 使用说明:"
        echo "1. 查看日志: s logs --tail"
        echo "2. 更新函数: s deploy"
        echo "3. 删除函数: s remove"
        echo "4. 监控函数: 阿里云FC控制台"
        echo ""
        echo "📚 更多信息请参考: ALIYUN_FC_DEPLOYMENT_GUIDE.md"

    else
        log_error "部署失败，请检查配置和网络连接"
        exit 1
    fi

    log_success "🎉 阿里云FC自动化部署完成!"
}

# 错误处理
trap 'log_error "部署过程中发生错误，请检查配置和网络连接"' ERR

# 执行主函数
main "$@"