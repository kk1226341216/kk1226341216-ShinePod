#!/bin/bash
# 拾光豆（ShinePod）启动脚本

echo "🚀 启动拾光豆（ShinePod）服务..."

# 检查PM2是否安装
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2未安装，请先安装PM2: npm install -g pm2"
    exit 1
fi

# 启动服务
pm2 start deployment/ecosystem.config.js --env production

echo "✅ 服务启动完成！"
echo "📊 查看状态: pm2 status"
echo "📝 查看日志: pm2 logs"