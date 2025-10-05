#!/bin/bash
# 拾光豆（ShinePod）重启脚本

echo "🔄 重启拾光豆（ShinePod）服务..."

# 重启PM2服务
pm2 restart all

echo "✅ 服务重启完成！"