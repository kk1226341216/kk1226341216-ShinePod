# 拾光豆（ShinePod）监控配置

# PM2监控
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true

# 系统监控脚本
#!/bin/bash
# 系统监控脚本

LOG_FILE="./logs/system-monitor.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# 检查服务状态
check_service() {
    local service_name=$1
    local port=$2
    
    if curl -s http://localhost:$port/health > /dev/null; then
        echo "[$DATE] ✅ $service_name 服务正常" >> $LOG_FILE
    else
        echo "[$DATE] ❌ $service_name 服务异常" >> $LOG_FILE
        # 发送告警通知
        # 这里可以添加邮件、短信等告警方式
    fi
}

# 检查各个服务
check_service "Backend" 3000
check_service "Mobile App" 3002

# 检查系统资源
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.2f", $3/$2 * 100.0}')

echo "[$DATE] 📊 CPU使用率: $CPU_USAGE%" >> $LOG_FILE
echo "[$DATE] 📊 内存使用率: $MEMORY_USAGE%" >> $LOG_FILE

# 如果资源使用率过高，发送告警
if (( $(echo "$CPU_USAGE > 80" | bc -l) )); then
    echo "[$DATE] ⚠️ CPU使用率过高: $CPU_USAGE%" >> $LOG_FILE
fi

if (( $(echo "$MEMORY_USAGE > 80" | bc -l) )); then
    echo "[$DATE] ⚠️ 内存使用率过高: $MEMORY_USAGE%" >> $LOG_FILE
fi