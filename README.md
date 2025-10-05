# 拾光豆（ShinePod）微信公众号集成服务

## 项目概述

这是拾光豆（ShinePod）应用的微信公众号集成服务，用于接收、处理和同步微信消息到ShinePod App。该服务提供了微信消息接收、解析、语音识别、NLP处理、WebSocket实时同步等功能。

## 功能特性

- **微信消息接收与处理**：支持文本、语音、图片等多种消息类型
- **微信OAuth2.0认证**：实现用户授权登录
- **语音识别**：集成百度AI语音识别服务，将语音消息转换为文本
- **WebSocket实时同步**：将微信消息实时同步到ShinePod App
- **MongoDB数据存储**：存储微信消息和用户数据
- **错误处理与日志记录**：完善的错误处理机制和详细的日志记录

## 技术栈

- **后端框架**：Express.js
- **数据库**：MongoDB
- **WebSocket**：ws
- **消息处理**：xml2js（XML解析）
- **语音识别**：百度AI API
- **配置管理**：dotenv
- **日志记录**：winston
- **安全**：helmet、cors

## 项目结构

```
├── server/
│   ├── app.js                 # 应用入口文件
│   ├── controllers/           # 控制器
│   │   ├── wechatController.js  # 微信消息控制器
│   │   └── taskController.js    # 任务控制器
│   ├── models/                # 数据模型
│   │   └── wechatMessageModel.js  # 微信消息模型
│   ├── routes/                # 路由
│   │   ├── wechatRoutes.js     # 微信相关路由
│   │   └── taskRoutes.js       # 任务相关路由
│   ├── services/              # 服务层
│   │   └── wechatService.js    # 微信服务
│   ├── utils/                 # 工具函数
│   │   ├── errorHandler.js     # 错误处理工具
│   │   ├── logger.js           # 日志工具
│   │   └── xmlParser.js        # XML解析工具
│   └── config/                # 配置文件
│       └── config.js           # 应用配置
├── .env                       # 环境变量配置
├── package.json               # 项目依赖
└── README.md                  # 项目文档
```

## 安装与运行

### 前提条件

- Node.js 14.x 或更高版本
- MongoDB 4.x 或更高版本
- 微信公众号开发者账号
- 百度AI开放平台账号（用于语音识别）

### 安装步骤

1. **克隆项目**

```bash
git clone <项目仓库地址>
cd shinepod-wechat-integration
```

2. **安装依赖**

```bash
npm install
```

3. **配置环境变量**

复制 `.env` 文件并根据实际情况修改配置：

```bash
cp .env.example .env
```

主要配置项说明：

- `WECHAT_APPID`：微信公众号AppID
- `WECHAT_SECRET`：微信公众号AppSecret
- `WECHAT_TOKEN`：微信消息验证Token
- `MONGO_URI`：MongoDB连接地址
- `BAIDU_AI_APPID`：百度AI应用ID
- `BAIDU_AI_API_KEY`：百度AI API Key
- `BAIDU_AI_SECRET_KEY`：百度AI Secret Key

4. **启动服务**

开发模式（带热重载）：

```bash
npm run dev
```

生产模式：

```bash
npm start
```

服务默认运行在 `http://0.0.0.0:3000`

## API接口文档

### 微信相关接口

1. **微信消息接收接口**

   - 路径：`/wechat/message`
   - 方法：GET/POST
   - 描述：接收微信服务器发送的消息和验证请求

2. **微信OAuth授权接口**

   - 路径：`/wechat/oauth`
   - 方法：GET
   - 参数：`redirect_uri`（授权回调地址），`state`（状态参数）
   - 描述：引导用户进行微信授权

3. **微信OAuth回调接口**

   - 路径：`/wechat/oauth/callback`
   - 方法：GET
   - 参数：`code`（授权码），`state`（状态参数）
   - 描述：处理微信授权回调，获取用户信息

### 任务相关接口

1. **获取微信任务列表**

   - 路径：`/tasks/wechat`
   - 方法：GET
   - 参数：`userId`（用户ID），`limit`（每页数量），`skip`（跳过数量），`status`（任务状态）
   - 描述：获取指定用户的微信消息任务列表

2. **获取单个微信任务详情**

   - 路径：`/tasks/wechat/:id`
   - 方法：GET
   - 参数：`userId`（用户ID）
   - 描述：获取单个微信消息任务的详细信息

3. **更新微信任务状态**

   - 路径：`/tasks/wechat/:id/status`
   - 方法：PUT
   - 参数：`userId`（用户ID），`status`（任务状态：pending, synced, failed）
   - 描述：更新微信消息任务的状态

4. **搜索微信任务**

   - 路径：`/tasks/wechat/search`
   - 方法：GET
   - 参数：`userId`，`keyword`，`startDate`，`endDate`，`contentType`
   - 描述：搜索微信消息任务

## WebSocket实时同步

服务支持WebSocket连接，用于将微信消息实时同步到ShinePod App。

### 连接方式

```javascript
const ws = new WebSocket('ws://your-server.com:3000');

ws.onopen = () => {
  // 连接建立后，发送用户ID进行绑定
  ws.send(JSON.stringify({ userId: 'user123' }));
};

ws.onmessage = (event) => {
  // 接收实时消息
  const data = JSON.parse(event.data);
  console.log('收到实时消息:', data);
};
```

### 消息格式

实时同步的微信消息格式：

```json
{
  "type": "wechat_message",
  "data": {
    "_id": "消息ID",
    "wechat_msg_id": "微信消息ID",
    "user_id": "用户ID",
    "content_type": "text",
    "content": "消息内容",
    "converted_text": "转换后的文本",
    "status": "pending",
    "created_at": 1691234567890
  }
}
```

## 微信公众号配置

需要在微信公众号后台进行以下配置：

1. **服务器配置**
   - URL：`https://your-server.com/wechat/message`
   - Token：与`.env`文件中的`WECHAT_TOKEN`保持一致
   - 消息加密方式：根据需要选择（兼容模式或安全模式）

2. **授权回调域名**
   - 设置为你的服务器域名

## 部署建议

1. **使用PM2进行进程管理**

```bash
npm install pm2 -g
pm run build # 如果有构建步骤
pm start:pm2 # 或 pm2 start server/app.js --name shinepod-wechat
```

2. **配置Nginx反向代理**

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. **配置HTTPS**

建议使用Let's Encrypt免费证书为服务配置HTTPS，微信公众号接口要求服务器必须支持HTTPS。

## 常见问题与解决方案

1. **微信消息验证失败**
   - 检查`WECHAT_TOKEN`是否与微信公众号后台配置一致
   - 检查服务器URL是否可从外网访问

2. **数据库连接失败**
   - 检查MongoDB服务是否运行
   - 检查`MONGO_URI`配置是否正确

3. **WebSocket连接断开**
   - 检查网络连接是否稳定
   - 考虑在客户端实现自动重连机制

## 日志管理

日志文件存放在`./logs/`目录下，包括：
- `app.log`：应用主日志
- `error.log`：错误日志
- `http.log`：HTTP请求日志
- `wechat.log`：微信相关日志
- `db.log`：数据库操作日志

## 开发指南

1. **代码规范**
   - 使用ES6+语法
   - 遵循Node.js最佳实践
   - 每个功能模块独立成文件

2. **测试**
   - 建议使用Jest进行单元测试和集成测试
   - 测试文件放在`test/`目录下

3. **提交代码**
   - 遵循Git工作流
   - 提交前运行代码检查和测试

## License

ISC License