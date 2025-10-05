const fs = require('fs');
const path = require('path');

// 部署准备工具
class DeploymentPreparer {
  constructor() {
    this.projectRoot = __dirname;
  }

  // 创建生产环境配置
  createProductionConfig() {
    console.log('🔧 创建生产环境配置...');

    const prodEnvContent = `# 生产环境配置
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# 数据库配置
MONGO_URI=mongodb://localhost:27017/shinepod_prod

# 微信公众号配置（生产环境）
WECHAT_APPID=YOUR_PRODUCTION_WECHAT_APPID
WECHAT_SECRET=YOUR_PRODUCTION_WECHAT_SECRET
WECHAT_TOKEN=YOUR_PRODUCTION_WECHAT_TOKEN
WECHAT_ENCODING_AES_KEY=YOUR_PRODUCTION_WECHAT_ENCODING_AES_KEY
WECHAT_SERVER_URL=https://your-production-domain.com

# 百度AI配置
BAIDU_AI_APPID=YOUR_PRODUCTION_BAIDU_AI_APPID
BAIDU_AI_API_KEY=YOUR_PRODUCTION_BAIDU_AI_API_KEY
BAIDU_AI_SECRET_KEY=YOUR_PRODUCTION_BAIDU_AI_SECRET_KEY

# 安全配置
JWT_SECRET=your-super-secure-production-jwt-secret-key
JWT_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=12

# 日志配置
LOG_LEVEL=warn
LOG_FILE=./logs/app.log

# 生产环境优化
PRODUCTION_GZIP=true
API_TIMEOUT=30000

# HTTPS配置（如果需要）
# PRODUCTION_HTTPS=true
# PRODUCTION_SSL_KEY_PATH=/path/to/ssl.key
# PRODUCTION_SSL_CERT_PATH=/path/to/ssl.crt

# 监控配置
MONITOR_ENABLED=true
MONITOR_PORT=8080

# 限流配置
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW_MS=60000
`;

    try {
      fs.writeFileSync(path.join(this.projectRoot, '.env.production'), prodEnvContent);
      console.log('✅ 生产环境配置文件已创建: .env.production');
      return true;
    } catch (error) {
      console.error('❌ 创建生产环境配置失败:', error.message);
      return false;
    }
  }

  // 创建PM2配置文件
  createPM2Config() {
    console.log('🔧 创建PM2配置文件...');

    const pm2Config = {
      apps: [{
        name: 'shinepod-wechat',
        script: 'server/app.js',
        instances: 'max',
        exec_mode: 'cluster',
        env: {
          NODE_ENV: 'development'
        },
        env_production: {
          NODE_ENV: 'production'
        },
        log_file: './logs/pm2.log',
        out_file: './logs/pm2-out.log',
        error_file: './logs/pm2-error.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,
        max_memory_restart: '1G',
        node_args: '--max-old-space-size=1024',
        watch: false,
        ignore_watch: ['node_modules', 'logs'],
        restart_delay: 4000,
        max_restarts: 10,
        min_uptime: '10s'
      }]
    };

    try {
      fs.writeFileSync(
        path.join(this.projectRoot, 'ecosystem.config.js'),
        `module.exports = ${JSON.stringify(pm2Config, null, 2)};`
      );
      console.log('✅ PM2配置文件已创建: ecosystem.config.js');
      return true;
    } catch (error) {
      console.error('❌ 创建PM2配置失败:', error.message);
      return false;
    }
  }

  // 创建Nginx配置模板
  createNginxConfig() {
    console.log('🔧 创建Nginx配置模板...');

    const nginxConfig = `# Nginx配置模板 - 拾光豆微信公众号集成服务
# 请根据实际情况修改域名和SSL证书路径

upstream shinepod_backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

# HTTP重定向到HTTPS
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS配置
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL证书配置
    ssl_certificate /path/to/your/ssl.crt;
    ssl_certificate_key /path/to/your/ssl.key;
    
    # SSL安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # 日志配置
    access_log /var/log/nginx/shinepod_access.log;
    error_log /var/log/nginx/shinepod_error.log;

    # 文件上传大小限制
    client_max_body_size 10M;

    # 代理配置
    location / {
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

    # WebSocket支持
    location /socket.io/ {
        proxy_pass http://shinepod_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 静态文件缓存
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
`;

    try {
      fs.writeFileSync(path.join(this.projectRoot, 'nginx.conf'), nginxConfig);
      console.log('✅ Nginx配置模板已创建: nginx.conf');
      return true;
    } catch (error) {
      console.error('❌ 创建Nginx配置失败:', error.message);
      return false;
    }
  }

  // 创建Docker配置
  createDockerConfig() {
    console.log('🔧 创建Docker配置...');

    const dockerfile = `# Dockerfile - 拾光豆微信公众号集成服务
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production && npm cache clean --force

# 复制源代码
COPY . .

# 创建非root用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# 创建必要目录
RUN mkdir -p logs temp && chown -R nodejs:nodejs logs temp

# 切换到非root用户
USER nodejs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# 启动应用
CMD ["npm", "start"]
`;

    const dockerCompose = `# docker-compose.yml - 拾光豆微信公众号集成服务
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGO_URI=mongodb://mongo:27017/shinepod
    depends_on:
      - mongo
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped

  mongo:
    image: mongo:6.0
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    restart: unless-stopped

volumes:
  mongo_data:
`;

    try {
      fs.writeFileSync(path.join(this.projectRoot, 'Dockerfile'), dockerfile);
      fs.writeFileSync(path.join(this.projectRoot, 'docker-compose.yml'), dockerCompose);
      console.log('✅ Docker配置文件已创建: Dockerfile, docker-compose.yml');
      return true;
    } catch (error) {
      console.error('❌ 创建Docker配置失败:', error.message);
      return false;
    }
  }

  // 创建部署脚本
  createDeploymentScripts() {
    console.log('🔧 创建部署脚本...');

    const deployScript = `#!/bin/bash

# 拾光豆微信公众号集成服务 - 部署脚本

echo "🚀 开始部署拾光豆微信公众号集成服务..."

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    exit 1
fi

# 检查PM2
if ! command -v pm2 &> /dev/null; then
    echo "📦 安装PM2..."
    npm install -g pm2
fi

# 检查MongoDB
if ! command -v mongod &> /dev/null; then
    echo "❌ MongoDB 未安装"
    exit 1
fi

# 停止现有服务
echo "🛑 停止现有服务..."
pm2 stop shinepod-wechat 2>/dev/null || true

# 安装依赖
echo "📦 安装依赖..."
npm ci --only=production

# 初始化数据库
echo "🗄️ 初始化数据库..."
npm run init-db

# 启动服务
echo "🚀 启动服务..."
pm2 start ecosystem.config.js --env production

# 保存PM2配置
pm2 save

# 设置开机自启
pm2 startup

echo "✅ 部署完成！"
echo "📊 服务状态:"
pm2 status

echo "📝 查看日志: pm2 logs shinepod-wechat"
`;

    const stopScript = `#!/bin/bash

# 停止服务脚本

echo "🛑 停止拾光豆微信公众号集成服务..."

pm2 stop shinepod-wechat
pm2 delete shinepod-wechat

echo "✅ 服务已停止"
`;

    const restartScript = `#!/bin/bash

# 重启服务脚本

echo "🔄 重启拾光豆微信公众号集成服务..."

pm2 restart shinepod-wechat

echo "✅ 服务已重启"
`;

    try {
      fs.writeFileSync(path.join(this.projectRoot, 'deploy.sh'), deployScript);
      fs.writeFileSync(path.join(this.projectRoot, 'stop.sh'), stopScript);
      fs.writeFileSync(path.join(this.projectRoot, 'restart.sh'), restartScript);
      
      // 添加执行权限
      ['deploy.sh', 'stop.sh', 'restart.sh'].forEach(file => {
        fs.chmodSync(path.join(this.projectRoot, file), '755');
      });
      
      console.log('✅ 部署脚本已创建: deploy.sh, stop.sh, restart.sh');
      return true;
    } catch (error) {
      console.error('❌ 创建部署脚本失败:', error.message);
      return false;
    }
  }

  // 创建监控脚本
  createMonitoringScript() {
    console.log('🔧 创建监控脚本...');

    const monitorScript = `#!/bin/bash

# 监控脚本

echo "📊 拾光豆微信公众号集成服务监控报告"
echo "=================================="

# PM2状态
echo "🔍 PM2服务状态:"
pm2 status

echo ""

# 系统资源
echo "💻 系统资源使用:"
echo "CPU使用率:"
top -l 1 | grep "CPU usage"

echo "内存使用:"
top -l 1 | grep "PhysMem"

echo ""

# 磁盘使用
echo "💾 磁盘使用:"
df -h

echo ""

# 网络连接
echo "🌐 网络连接:"
netstat -an | grep :3000 | wc -l | xargs echo "端口3000连接数:"

echo ""

# 日志大小
echo "📝 日志文件大小:"
ls -lh logs/ 2>/dev/null || echo "日志目录不存在"

echo ""

# 数据库连接
echo "🗄️ 数据库状态:"
mongo --eval "db.runCommand({ping: 1})" shinepod 2>/dev/null && echo "MongoDB连接正常" || echo "MongoDB连接异常"

echo ""

# 健康检查
echo "🏥 健康检查:"
curl -s http://localhost:3000/health | jq . 2>/dev/null || curl -s http://localhost:3000/health

echo ""
echo "✅ 监控报告完成"
`;

    try {
      fs.writeFileSync(path.join(this.projectRoot, 'monitor.sh'), monitorScript);
      fs.chmodSync(path.join(this.projectRoot, 'monitor.sh'), '755');
      console.log('✅ 监控脚本已创建: monitor.sh');
      return true;
    } catch (error) {
      console.error('❌ 创建监控脚本失败:', error.message);
      return false;
    }
  }

  // 运行所有部署准备
  async prepareDeployment() {
    console.log('🚀 开始部署准备...\n');

    const results = {
      productionConfig: false,
      pm2Config: false,
      nginxConfig: false,
      dockerConfig: false,
      deploymentScripts: false,
      monitoringScript: false
    };

    results.productionConfig = this.createProductionConfig();
    results.pm2Config = this.createPM2Config();
    results.nginxConfig = this.createNginxConfig();
    results.dockerConfig = this.createDockerConfig();
    results.deploymentScripts = this.createDeploymentScripts();
    results.monitoringScript = this.createMonitoringScript();

    console.log('\n📊 部署准备结果:');
    console.log('================');

    const configNames = {
      productionConfig: '生产环境配置',
      pm2Config: 'PM2配置',
      nginxConfig: 'Nginx配置',
      dockerConfig: 'Docker配置',
      deploymentScripts: '部署脚本',
      monitoringScript: '监控脚本'
    };

    Object.keys(results).forEach(key => {
      const status = results[key] ? '✅' : '❌';
      console.log(`${status} ${configNames[key]}`);
    });

    const successCount = Object.values(results).filter(Boolean).length;
    const totalCount = Object.keys(results).length;

    console.log(`\n🎯 完成率: ${successCount}/${totalCount}`);

    if (successCount === totalCount) {
      console.log('🎉 部署准备完成！');
      console.log('\n📋 接下来的步骤:');
      console.log('1. 配置生产环境参数 (.env.production)');
      console.log('2. 配置Nginx (nginx.conf)');
      console.log('3. 运行部署脚本: ./deploy.sh');
      console.log('4. 监控服务状态: ./monitor.sh');
    } else {
      console.log('⚠️  部分配置创建失败，请检查错误信息');
    }

    return results;
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const preparer = new DeploymentPreparer();
  
  preparer.prepareDeployment()
    .then(results => {
      const allSuccess = Object.values(results).every(Boolean);
      process.exit(allSuccess ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 部署准备过程中发生错误:', error.message);
      process.exit(1);
    });
}

module.exports = DeploymentPreparer;
