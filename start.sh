#!/bin/bash

# 拾光豆（ShinePod）微信公众号集成服务 - 启动脚本

echo "🚀 拾光豆（ShinePod）微信公众号集成服务启动脚本"
echo "=================================================="

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    echo "📖 请参考 NODEJS_INSTALL_GUIDE.md 安装Node.js"
    echo "💡 或者双击 nodejs.pkg 文件进行安装"
    exit 1
fi

echo "✅ Node.js 已安装: $(node --version)"

# 检查npm是否可用
if ! command -v npm &> /dev/null; then
    echo "❌ npm 未找到"
    exit 1
fi

echo "✅ npm 已安装: $(npm --version)"

# 检查.env文件是否存在
if [ ! -f ".env" ]; then
    echo "❌ .env 文件不存在"
    echo "📝 请创建 .env 文件并配置必要的环境变量"
    exit 1
fi

echo "✅ .env 配置文件存在"

# 检查node_modules是否存在
if [ ! -d "node_modules" ]; then
    echo "📦 安装项目依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
    echo "✅ 依赖安装完成"
else
    echo "✅ 项目依赖已安装"
fi

# 检查MongoDB是否运行
if ! pgrep -x "mongod" > /dev/null; then
    echo "⚠️  MongoDB 未运行"
    echo "💡 请启动MongoDB服务："
    echo "   brew services start mongodb-community"
    echo "   或者：mongod --dbpath /usr/local/var/mongodb"
fi

# 创建必要的目录
mkdir -p logs
mkdir -p temp

echo ""
echo "🎯 启动选项："
echo "1. 开发模式 (带热重载)"
echo "2. 生产模式"
echo "3. 仅检查配置"
echo ""

read -p "请选择启动模式 (1-3): " choice

case $choice in
    1)
        echo "🔧 启动开发模式..."
        npm run dev
        ;;
    2)
        echo "🚀 启动生产模式..."
        npm start
        ;;
    3)
        echo "🔍 检查配置..."
        echo "✅ 所有基本配置检查完成"
        echo "📋 接下来需要配置："
        echo "   - 微信公众号参数 (WECHAT_APPID, WECHAT_SECRET等)"
        echo "   - 百度AI参数 (BAIDU_AI_API_KEY等)"
        echo "   - MongoDB连接"
        ;;
    *)
        echo "❌ 无效选择"
        exit 1
        ;;
esac
