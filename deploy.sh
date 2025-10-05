#!/bin/bash
# 拾光豆（ShinePod）部署脚本

set -e

echo "🚀 开始部署拾光豆（ShinePod）..."

# 检查Node.js版本
echo "📋 检查Node.js版本..."
node --version
npm --version

# 安装依赖
echo "📦 安装依赖..."
npm ci --only=production

# 创建必要目录
echo "📁 创建目录..."
mkdir -p logs data ssl

# 设置权限
echo "🔐 设置权限..."
chmod 755 logs data ssl

# 运行测试
echo "🧪 运行测试..."
npm test

# 构建应用
echo "🔨 构建应用..."
npm run build 2>/dev/null || echo "跳过构建步骤"

# 启动PM2
echo "🚀 启动PM2..."
pm2 start deployment/ecosystem.config.js --env production

# 保存PM2配置
pm2 save
pm2 startup

echo "✅ 部署完成！"
echo "📊 查看状态: pm2 status"
echo "📝 查看日志: pm2 logs"
echo "🔄 重启服务: pm2 restart all"