#!/bin/bash
# 拾光豆（ShinePod）停止脚本

echo "🛑 停止拾光豆（ShinePod）服务..."

# 停止PM2服务
pm2 stop all

echo "✅ 服务已停止！"