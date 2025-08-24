#!/bin/bash

# AI质量测试快速运行脚本
# 使用方法: ./run-quality-test.sh [test-type]

cd "$(dirname "$0")"

echo "🎯 AI翻译与重写质量测试工具"
echo "================================"

# 默认配置
CONFIG_FILE="../../config/config.remote-230.json"
URL_FILE="../../examples/quality-test-urls.txt"
TEST_SCRIPT="./ai-quality-tester.js"

# 检查文件是否存在
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ 配置文件不存在: $CONFIG_FILE"
    exit 1
fi

if [ ! -f "$URL_FILE" ]; then
    echo "❌ URL文件不存在: $URL_FILE"
    exit 1
fi

if [ ! -f "$TEST_SCRIPT" ]; then
    echo "❌ 测试脚本不存在: $TEST_SCRIPT"
    exit 1
fi

# 根据参数选择测试类型
TEST_TYPE=${1:-"default"}

case $TEST_TYPE in
    "default")
        echo "📋 运行默认配置测试..."
        node "$TEST_SCRIPT" "$CONFIG_FILE" "$URL_FILE"
        ;;
    "multi")
        echo "📋 运行多引擎对比测试..."
        node "$TEST_SCRIPT" "$CONFIG_FILE" "$URL_FILE" --engines=qwen,gemini
        ;;
    "qwen")
        echo "📋 运行Qwen引擎专项测试..."
        node "$TEST_SCRIPT" "$CONFIG_FILE" "$URL_FILE" --engines=qwen
        ;;
    "gemini")
        echo "📋 运行Gemini引擎专项测试..."
        node "$TEST_SCRIPT" "$CONFIG_FILE" "$URL_FILE" --engines=gemini
        ;;
    *)
        echo "❌ 无效的测试类型: $TEST_TYPE"
        echo ""
        echo "支持的测试类型:"
        echo "  default  - 默认配置测试"
        echo "  multi    - 多引擎对比测试"
        echo "  qwen     - Qwen引擎专项测试"
        echo "  gemini   - Gemini引擎专项测试"
        echo ""
        echo "使用示例:"
        echo "  ./run-quality-test.sh default"
        echo "  ./run-quality-test.sh multi"
        exit 1
        ;;
esac

echo ""
echo "✅ 测试完成！查看reports目录下的详细报告。"
