# 🚀 拾光豆（ShinePod）快速开始指南

## 📋 前置要求

- **Node.js 14.x 或更高版本**
- **MongoDB 4.x 或更高版本**
- **微信公众号开发者账号**
- **百度AI开放平台账号**

## ⚡ 快速启动

### 1. 安装Node.js

如果还没有安装Node.js，请参考 `NODEJS_INSTALL_GUIDE.md` 或双击 `nodejs.pkg` 文件。

### 2. 一键启动

```bash
# 给启动脚本添加执行权限（如果还没有）
chmod +x start.sh

# 运行启动脚本
./start.sh
```

### 3. 手动启动（可选）

```bash
# 检查配置
npm run check-config

# 安装依赖
npm install

# 初始化数据库
npm run init-db

# 启动开发服务器
npm run dev
```

## 🔧 配置说明

### 环境变量配置

编辑 `.env` 文件，配置以下关键参数：

```bash
# 微信公众号配置
WECHAT_APPID=你的微信公众号AppID
WECHAT_SECRET=你的微信公众号AppSecret
WECHAT_TOKEN=你的微信公众号Token

# 百度AI配置
BAIDU_AI_API_KEY=你的百度AI API Key
BAIDU_AI_SECRET_KEY=你的百度AI Secret Key

# 数据库配置
MONGO_URI=mongodb://localhost:27017/shinepod
```

### 微信公众号配置

1. 登录[微信公众平台](https://mp.weixin.qq.com/)
2. 进入"开发" -> "基本配置"
3. 设置服务器URL：`https://your-domain.com/wechat/message`
4. 设置Token：与`.env`文件中的`WECHAT_TOKEN`保持一致
5. 选择消息加密方式（建议选择兼容模式）

### 百度AI配置

1. 访问[百度AI开放平台](https://ai.baidu.com/)
2. 创建应用并获取API Key和Secret Key
3. 确保开通语音识别服务
4. 将密钥配置到`.env`文件中

## 🗄️ 数据库设置

### 启动MongoDB

**macOS (使用Homebrew):**
```bash
brew services start mongodb-community
```

**macOS (手动启动):**
```bash
mongod --dbpath /usr/local/var/mongodb
```

**Linux:**
```bash
sudo systemctl start mongod
```

**Windows:**
```bash
net start MongoDB
```

### 初始化数据库

```bash
npm run init-db
```

## 🧪 测试功能

### 1. 健康检查

访问：`http://localhost:3000/health`

应该返回：
```json
{
  "status": "ok",
  "message": "服务运行正常"
}
```

### 2. 配置检查

```bash
npm run check-config
```

### 3. WebSocket测试

使用WebSocket客户端连接到：`ws://localhost:3000`

发送登录消息：
```json
{
  "type": "user_login",
  "userId": "test_user_001"
}
```

## 📱 API接口

### 微信相关接口

- `GET/POST /wechat/message` - 微信消息接收
- `GET /wechat/config` - 获取微信配置
- `GET /wechat/oauth` - 微信OAuth授权
- `GET /wechat/oauth/callback` - OAuth回调

### 任务相关接口

- `GET /tasks/wechat` - 获取微信任务列表
- `GET /tasks/wechat/:id` - 获取任务详情
- `PUT /tasks/wechat/:id/status` - 更新任务状态
- `GET /tasks/wechat/search` - 搜索任务

## 🔍 故障排除

### 常见问题

1. **Node.js未安装**
   - 解决方案：参考 `NODEJS_INSTALL_GUIDE.md`

2. **MongoDB连接失败**
   - 检查MongoDB服务是否运行
   - 检查`.env`文件中的`MONGO_URI`配置

3. **微信消息验证失败**
   - 检查`WECHAT_TOKEN`是否与公众号后台一致
   - 检查服务器URL是否可从外网访问

4. **百度AI语音识别失败**
   - 检查API Key和Secret Key是否正确
   - 确认已开通语音识别服务

### 日志查看

日志文件位置：`./logs/`
- `app.log` - 应用主日志
- `error.log` - 错误日志
- `http.log` - HTTP请求日志
- `wechat.log` - 微信相关日志

## 🚀 部署到生产环境

### 1. 环境配置

```bash
# 设置生产环境
export NODE_ENV=production

# 配置生产环境变量
# 编辑 .env 文件，设置生产环境参数
```

### 2. 使用PM2管理进程

```bash
# 安装PM2
npm install -g pm2

# 启动应用
pm2 start server/app.js --name shinepod-wechat

# 查看状态
pm2 status

# 查看日志
pm2 logs shinepod-wechat
```

### 3. 配置反向代理

使用Nginx配置反向代理和HTTPS。

## 📞 获取帮助

如果遇到问题，请：

1. 查看日志文件
2. 运行 `npm run check-config` 检查配置
3. 参考项目README.md文档
4. 检查GitHub Issues

---

**祝您使用愉快！** 🎉
