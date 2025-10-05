const fs = require('fs');
const path = require('path');

class ProductionDeployment {
  constructor() {
    this.projectRoot = __dirname;
    this.configDir = path.join(this.projectRoot, 'deployment');
    this.ensureConfigDir();
  }

  ensureConfigDir() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  // 创建PM2配置文件
  createPM2Config() {
    const pm2Config = {
      apps: [
        {
          name: 'shinepod-backend',
          script: './server-with-file-db.js',
          instances: 'max',
          exec_mode: 'cluster',
          env: {
            NODE_ENV: 'production',
            PORT: 3000,
            HOST: '0.0.0.0'
          },
          env_production: {
            NODE_ENV: 'production',
            PORT: 3000,
            HOST: '0.0.0.0'
          },
          log_file: './logs/backend.log',
          out_file: './logs/backend-out.log',
          error_file: './logs/backend-error.log',
          log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
          merge_logs: true,
          max_memory_restart: '1G',
          node_args: '--max-old-space-size=1024',
          restart_delay: 4000,
          max_restarts: 10,
          min_uptime: '10s',
          watch: false,
          ignore_watch: ['node_modules', 'logs', 'data'],
          watch_options: {
            followSymlinks: false
          }
        },
        {
          name: 'shinepod-mobile-app',
          script: './mobile-app-server.js',
          instances: 1,
          exec_mode: 'fork',
          env: {
            NODE_ENV: 'production',
            PORT: 3002,
            HOST: '0.0.0.0'
          },
          env_production: {
            NODE_ENV: 'production',
            PORT: 3002,
            HOST: '0.0.0.0'
          },
          log_file: './logs/mobile-app.log',
          out_file: './logs/mobile-app-out.log',
          error_file: './logs/mobile-app-error.log',
          log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
          merge_logs: true,
          max_memory_restart: '512M',
          restart_delay: 4000,
          max_restarts: 10,
          min_uptime: '10s',
          watch: false
        }
      ]
    };

    const configPath = path.join(this.configDir, 'ecosystem.config.js');
    const configContent = `module.exports = ${JSON.stringify(pm2Config, null, 2)};`;
    
    fs.writeFileSync(configPath, configContent);
    console.log(`✅ PM2配置文件已创建: ${configPath}`);
    
    return configPath;
  }

  // 创建Nginx配置文件
  createNginxConfig() {
    const nginxConfig = `# 拾光豆（ShinePod）Nginx配置
upstream shinepod_backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

upstream shinepod_mobile_app {
    server 127.0.0.1:3002;
    keepalive 16;
}

# 主服务器配置
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # 重定向到HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS服务器配置
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;
    
    # SSL证书配置
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # 安全头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # 日志配置
    access_log /var/log/nginx/shinepod_access.log;
    error_log /var/log/nginx/shinepod_error.log;
    
    # 文件上传大小限制
    client_max_body_size 10M;
    
    # 后端API代理
    location /api/ {
        proxy_pass http://shinepod_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # 微信消息接口
    location /wechat/ {
        proxy_pass http://shinepod_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # 任务接口
    location /tasks/ {
        proxy_pass http://shinepod_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # WebSocket代理
    location /socket.io/ {
        proxy_pass http://shinepod_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # 移动端App
    location / {
        proxy_pass http://shinepod_mobile_app;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # 静态文件缓存
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;
}`;

    const configPath = path.join(this.configDir, 'nginx.conf');
    fs.writeFileSync(configPath, nginxConfig);
    console.log(`✅ Nginx配置文件已创建: ${configPath}`);
    
    return configPath;
  }

  // 创建Docker配置
  createDockerConfig() {
    const dockerfile = `# 拾光豆（ShinePod）Dockerfile
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apk add --no-cache \\
    dumb-init \\
    && addgroup -g 1001 -S nodejs \\
    && adduser -S nodejs -u 1001

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production && npm cache clean --force

# 复制应用代码
COPY . .

# 创建日志目录
RUN mkdir -p logs data && chown -R nodejs:nodejs logs data

# 切换到非root用户
USER nodejs

# 暴露端口
EXPOSE 3000 3002

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# 启动应用
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]`;

    const dockerCompose = `# 拾光豆（ShinePod）Docker Compose配置
version: '3.8'

services:
  shinepod-backend:
    build: .
    container_name: shinepod-backend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - HOST=0.0.0.0
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - shinepod-network

  shinepod-mobile-app:
    build: .
    container_name: shinepod-mobile-app
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - PORT=3002
      - HOST=0.0.0.0
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    depends_on:
      - shinepod-backend
    networks:
      - shinepod-network

  nginx:
    image: nginx:alpine
    container_name: shinepod-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./deployment/nginx.conf:/etc/nginx/conf.d/default.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - shinepod-backend
      - shinepod-mobile-app
    restart: unless-stopped
    networks:
      - shinepod-network

networks:
  shinepod-network:
    driver: bridge

volumes:
  shinepod-data:
  shinepod-logs:`;

    const dockerfilePath = path.join(this.projectRoot, 'Dockerfile');
    const dockerComposePath = path.join(this.projectRoot, 'docker-compose.yml');
    
    fs.writeFileSync(dockerfilePath, dockerfile);
    fs.writeFileSync(dockerComposePath, dockerCompose);
    
    console.log(`✅ Dockerfile已创建: ${dockerfilePath}`);
    console.log(`✅ Docker Compose配置已创建: ${dockerComposePath}`);
    
    return { dockerfilePath, dockerComposePath };
  }

  // 创建部署脚本
  createDeploymentScripts() {
    const deployScript = `#!/bin/bash
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
echo "🔄 重启服务: pm2 restart all"`;

    const startScript = `#!/bin/bash
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
echo "📝 查看日志: pm2 logs"`;

    const stopScript = `#!/bin/bash
# 拾光豆（ShinePod）停止脚本

echo "🛑 停止拾光豆（ShinePod）服务..."

# 停止PM2服务
pm2 stop all

echo "✅ 服务已停止！"`;

    const restartScript = `#!/bin/bash
# 拾光豆（ShinePod）重启脚本

echo "🔄 重启拾光豆（ShinePod）服务..."

# 重启PM2服务
pm2 restart all

echo "✅ 服务重启完成！"`;

    const scripts = [
      { name: 'deploy.sh', content: deployScript },
      { name: 'start.sh', content: startScript },
      { name: 'stop.sh', content: stopScript },
      { name: 'restart.sh', content: restartScript }
    ];

    scripts.forEach(script => {
      const scriptPath = path.join(this.projectRoot, script.name);
      fs.writeFileSync(scriptPath, script.content);
      
      // 设置执行权限
      fs.chmodSync(scriptPath, '755');
      
      console.log(`✅ ${script.name}已创建: ${scriptPath}`);
    });

    return scripts.map(s => s.name);
  }

  // 创建环境变量模板
  createEnvTemplate() {
    const envTemplate = `# 拾光豆（ShinePod）生产环境配置

# 应用配置
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# 微信公众号配置
WECHAT_APPID=your_wechat_appid
WECHAT_SECRET=your_wechat_secret
WECHAT_TOKEN=your_wechat_token
WECHAT_ENCODING_AES_KEY=your_encoding_aes_key
WECHAT_SERVER_URL=https://your-domain.com

# 百度AI配置
BAIDU_AI_API_KEY=your_baidu_api_key
BAIDU_AI_SECRET_KEY=your_baidu_secret_key

# 数据库配置
MONGO_URI=mongodb://localhost:27017/shinepod

# 安全配置
JWT_SECRET=your-super-secure-jwt-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=12

# 日志配置
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# 生产环境优化
PRODUCTION_GZIP=true
API_TIMEOUT=30000

# PM2配置
PM2_INSTANCES=max
PM2_EXEC_MODE=cluster`;

    const envPath = path.join(this.configDir, '.env.production');
    fs.writeFileSync(envPath, envTemplate);
    console.log(`✅ 生产环境配置模板已创建: ${envPath}`);
    
    return envPath;
  }

  // 创建监控配置
  createMonitoringConfig() {
    const monitoringConfig = `# 拾光豆（ShinePod）监控配置

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
fi`;

    const monitoringPath = path.join(this.configDir, 'monitoring.sh');
    fs.writeFileSync(monitoringPath, monitoringConfig);
    fs.chmodSync(monitoringPath, '755');
    
    console.log(`✅ 监控配置已创建: ${monitoringPath}`);
    
    return monitoringPath;
  }

  // 生成所有配置文件
  generateAllConfigs() {
    console.log('🚀 开始生成生产环境部署配置...\n');
    
    const configs = {
      pm2: this.createPM2Config(),
      nginx: this.createNginxConfig(),
      docker: this.createDockerConfig(),
      scripts: this.createDeploymentScripts(),
      env: this.createEnvTemplate(),
      monitoring: this.createMonitoringConfig()
    };
    
    console.log('\n✅ 所有配置文件生成完成！');
    console.log('\n📋 部署步骤：');
    console.log('1. 配置环境变量: cp deployment/.env.production .env');
    console.log('2. 安装PM2: npm install -g pm2');
    console.log('3. 运行部署脚本: ./deploy.sh');
    console.log('4. 配置Nginx: 复制deployment/nginx.conf到Nginx配置目录');
    console.log('5. 启动监控: 设置crontab定时执行monitoring.sh');
    
    return configs;
  }
}

// 如果直接运行此文件，则生成所有配置
if (require.main === module) {
  const deployment = new ProductionDeployment();
  deployment.generateAllConfigs();
}

module.exports = ProductionDeployment;
