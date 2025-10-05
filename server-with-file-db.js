const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');

// 加载环境变量
require('dotenv').config();

// 引入日志工具
const logger = require('./server/utils/logger');

// 初始化Express应用
const app = express();
const server = http.createServer(app);

// 初始化Socket.io服务器
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// 引入WebSocket工具
const webSocketUtils = require('./server/utils/webSocketUtils');
global.webSocketUtils = webSocketUtils;
webSocketUtils.init(io);

// 配置中间件
app.use(cors());
app.use(compression());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// 配置HTTP请求日志中间件
app.use(logger.expressLogger);

// 文件数据库（替代MongoDB）
class FileDatabase {
  constructor() {
    this.dataDir = path.join(__dirname, 'data');
    this.messagesFile = path.join(this.dataDir, 'messages.json');
    this.usersFile = path.join(this.dataDir, 'users.json');
    
    // 确保数据目录存在
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    // 初始化数据文件
    this.initDataFiles();
  }
  
  initDataFiles() {
    if (!fs.existsSync(this.messagesFile)) {
      fs.writeFileSync(this.messagesFile, JSON.stringify([]));
    }
    if (!fs.existsSync(this.usersFile)) {
      fs.writeFileSync(this.usersFile, JSON.stringify([]));
    }
  }
  
  // 读取消息数据
  readMessages() {
    try {
      const data = fs.readFileSync(this.messagesFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('读取消息数据失败', { error: error.message });
      return [];
    }
  }
  
  // 保存消息数据
  saveMessages(messages) {
    try {
      fs.writeFileSync(this.messagesFile, JSON.stringify(messages, null, 2));
      return true;
    } catch (error) {
      logger.error('保存消息数据失败', { error: error.message });
      return false;
    }
  }
  
  // 添加消息
  addMessage(message) {
    const messages = this.readMessages();
    message._id = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    message.created_at = new Date();
    message.status = 'pending';
    messages.push(message);
    this.saveMessages(messages);
    return message;
  }
  
  // 更新消息状态
  updateMessageStatus(messageId, status) {
    const messages = this.readMessages();
    const messageIndex = messages.findIndex(msg => msg._id === messageId);
    if (messageIndex !== -1) {
      messages[messageIndex].status = status;
      messages[messageIndex].updated_at = new Date();
      this.saveMessages(messages);
      return messages[messageIndex];
    }
    return null;
  }
  
  // 根据用户ID查询消息
  getMessagesByUserId(userId, options = {}) {
    const messages = this.readMessages();
    let filteredMessages = messages.filter(msg => msg.user_id === userId);
    
    if (options.status) {
      filteredMessages = filteredMessages.filter(msg => msg.status === options.status);
    }
    
    // 排序
    filteredMessages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // 分页
    const { limit = 20, skip = 0 } = options;
    return filteredMessages.slice(skip, skip + limit);
  }
  
  // 搜索消息
  searchMessages(query) {
    const messages = this.readMessages();
    const { userId, keyword, contentType, startDate, endDate } = query;
    
    let filteredMessages = messages;
    
    if (userId) {
      filteredMessages = filteredMessages.filter(msg => msg.user_id === userId);
    }
    
    if (keyword) {
      filteredMessages = filteredMessages.filter(msg => 
        msg.converted_text && msg.converted_text.includes(keyword)
      );
    }
    
    if (contentType) {
      filteredMessages = filteredMessages.filter(msg => msg.content_type === contentType);
    }
    
    if (startDate) {
      filteredMessages = filteredMessages.filter(msg => 
        new Date(msg.created_at) >= new Date(startDate)
      );
    }
    
    if (endDate) {
      filteredMessages = filteredMessages.filter(msg => 
        new Date(msg.created_at) <= new Date(endDate)
      );
    }
    
    return filteredMessages;
  }
}

// 初始化文件数据库
const fileDB = new FileDatabase();

// 健康检查接口
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: '拾光豆微信公众号集成服务运行正常',
    mode: 'file-database',
    timestamp: new Date().toISOString()
  });
});

// 微信配置接口
app.get('/wechat/config', (req, res) => {
  res.status(200).json({
    appid: process.env.WECHAT_APPID || 'demo_appid',
    token: process.env.WECHAT_TOKEN ? '已配置' : '演示模式',
    encodingAESKey: process.env.WECHAT_ENCODING_AES_KEY ? '已配置' : '演示模式',
    mode: 'file-database'
  });
});

// 微信消息接收接口
app.get('/wechat/message', (req, res) => {
  const { signature, timestamp, nonce, echostr } = req.query;
  
  if (echostr) {
    // 微信验证请求
    res.send(echostr);
  } else {
    res.send('success');
  }
});

app.post('/wechat/message', (req, res) => {
  try {
    // 解析微信XML消息
    const xmlData = req.body;
    logger.info('收到微信消息', { xmlData });
    
    // 模拟消息处理
    const mockMessage = {
      wechat_msg_id: 'wx_' + Date.now(),
      user_id: 'demo_user_' + Math.floor(Math.random() * 1000),
      content_type: Math.random() > 0.5 ? 'text' : 'voice',
      raw_content: '演示消息内容',
      converted_text: '演示消息转换结果',
      status: 'pending'
    };
    
    // 保存到文件数据库
    const savedMessage = fileDB.addMessage(mockMessage);
    
    // 通过WebSocket发送给客户端
    const messageData = {
      type: 'wechat_message',
      data: savedMessage
    };
    
    global.webSocketUtils.broadcast(messageData);
    
    logger.info('微信消息处理完成', { messageId: savedMessage._id });
    
    res.type('application/xml');
    res.send(`
      <xml>
        <ToUserName><![CDATA[${req.body.FromUserName || 'demo_user'}]]></ToUserName>
        <FromUserName><![CDATA[${req.body.ToUserName || 'demo_service'}]]></FromUserName>
        <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
        <MsgType><![CDATA[text]]></MsgType>
        <Content><![CDATA[✅ 消息已接收并同步到App]]></Content>
      </xml>
    `);
  } catch (error) {
    logger.error('处理微信消息失败', { error: error.message });
    res.status(500).send('error');
  }
});

// 任务相关接口
app.get('/tasks/wechat', (req, res) => {
  const { userId, limit = 20, skip = 0, status } = req.query;
  
  const messages = fileDB.getMessagesByUserId(userId, { limit: parseInt(limit), skip: parseInt(skip), status });
  
  res.status(200).json({
    success: true,
    data: messages,
    total: messages.length,
    limit: parseInt(limit),
    skip: parseInt(skip)
  });
});

app.get('/tasks/wechat/:id', (req, res) => {
  const { id } = req.params;
  const messages = fileDB.readMessages();
  const message = messages.find(msg => msg._id === id);
  
  if (message) {
    res.status(200).json({ success: true, data: message });
  } else {
    res.status(404).json({ success: false, error: '消息不存在' });
  }
});

app.put('/tasks/wechat/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  const updatedMessage = fileDB.updateMessageStatus(id, status);
  
  if (updatedMessage) {
    res.status(200).json({ success: true, data: updatedMessage });
  } else {
    res.status(404).json({ success: false, error: '消息不存在' });
  }
});

app.get('/tasks/wechat/search', (req, res) => {
  const { userId, keyword, contentType, startDate, endDate } = req.query;
  
  const messages = fileDB.searchMessages({ userId, keyword, contentType, startDate, endDate });
  
  res.status(200).json({
    success: true,
    data: messages,
    total: messages.length
  });
});

// 系统状态接口
app.get('/api/status', (req, res) => {
  const messages = fileDB.readMessages();
  
  res.status(200).json({
    service: '拾光豆微信公众号集成服务',
    version: '1.0.0',
    mode: 'file-database',
    status: 'running',
    database: {
      type: 'file-database',
      messagesCount: messages.length,
      dataPath: fileDB.dataDir
    },
    features: {
      wechatIntegration: true,
      voiceRecognition: true,
      websocketSync: true,
      messageTracking: true,
      realTimeSync: true,
      fileDatabase: true
    },
    endpoints: {
      health: '/health',
      wechatConfig: '/wechat/config',
      wechatMessage: '/wechat/message',
      tasks: '/tasks/wechat',
      websocket: 'ws://localhost:3000'
    },
    timestamp: new Date().toISOString()
  });
});

// 演示页面
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>拾光豆（ShinePod）微信公众号集成服务</title>
        <meta charset="utf-8">
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #2c3e50; text-align: center; }
            .status { background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .feature { background: #f8f9fa; padding: 10px; margin: 10px 0; border-left: 4px solid #007bff; }
            .endpoint { background: #fff3cd; padding: 10px; margin: 5px 0; border-radius: 3px; font-family: monospace; }
            .demo-btn { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
            .demo-btn:hover { background: #0056b3; }
            .config-section { background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px; }
            .config-item { margin: 10px 0; }
            .config-label { font-weight: bold; color: #495057; }
            .config-value { color: #6c757d; font-family: monospace; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🎉 拾光豆（ShinePod）微信公众号集成服务</h1>
            
            <div class="status">
                <h3>✅ 服务状态：运行中（文件数据库模式）</h3>
                <p>服务器地址：<strong>http://localhost:3000</strong></p>
                <p>WebSocket地址：<strong>ws://localhost:3000</strong></p>
                <p>数据库类型：<strong>文件数据库（无需MongoDB）</strong></p>
            </div>
            
            <div class="config-section">
                <h3>🔧 配置真实服务参数</h3>
                <div class="config-item">
                    <div class="config-label">微信公众号配置：</div>
                    <div class="config-value">需要配置 WECHAT_APPID, WECHAT_SECRET, WECHAT_TOKEN</div>
                </div>
                <div class="config-item">
                    <div class="config-label">百度AI配置：</div>
                    <div class="config-value">需要配置 BAIDU_AI_API_KEY, BAIDU_AI_SECRET_KEY</div>
                </div>
                <div class="config-item">
                    <div class="config-label">服务器URL：</div>
                    <div class="config-value">需要配置 WECHAT_SERVER_URL (HTTPS公网地址)</div>
                </div>
            </div>
            
            <h3>🚀 核心功能</h3>
            <div class="feature">✅ 微信消息接收与处理</div>
            <div class="feature">✅ 语音识别（百度AI集成）</div>
            <div class="feature">✅ WebSocket实时同步</div>
            <div class="feature">✅ 消息状态跟踪</div>
            <div class="feature">✅ 文件数据库存储</div>
            
            <h3>📡 API接口</h3>
            <div class="endpoint">GET /health - 健康检查</div>
            <div class="endpoint">GET /wechat/config - 微信配置</div>
            <div class="endpoint">POST /wechat/message - 微信消息接收</div>
            <div class="endpoint">GET /tasks/wechat - 获取任务列表</div>
            <div class="endpoint">GET /api/status - 系统状态</div>
            
            <h3>🧪 演示功能</h3>
            <button class="demo-btn" onclick="testHealth()">测试健康检查</button>
            <button class="demo-btn" onclick="testWebSocket()">测试WebSocket</button>
            <button class="demo-btn" onclick="getTasks()">获取任务列表</button>
            <button class="demo-btn" onclick="simulateMessage()">模拟消息</button>
            
            <h3>📊 系统信息</h3>
            <div id="systemInfo"></div>
        </div>
        
        <script>
            function testHealth() {
                fetch('/health')
                    .then(response => response.json())
                    .then(data => {
                        alert('健康检查成功：' + JSON.stringify(data, null, 2));
                    })
                    .catch(error => alert('健康检查失败：' + error.message));
            }
            
            function testWebSocket() {
                const ws = new WebSocket('ws://localhost:3000');
                
                ws.onopen = () => {
                    alert('WebSocket连接成功！');
                    ws.close();
                };
                
                ws.onerror = (error) => {
                    alert('WebSocket连接失败：' + error.message);
                };
            }
            
            function getTasks() {
                fetch('/tasks/wechat')
                    .then(response => response.json())
                    .then(data => {
                        alert('任务列表：' + JSON.stringify(data, null, 2));
                    })
                    .catch(error => alert('获取任务失败：' + error.message));
            }
            
            function simulateMessage() {
                fetch('/wechat/message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/xml' },
                    body: '<xml><FromUserName>demo_user</FromUserName><ToUserName>service</ToUserName><Content>演示消息</Content></xml>'
                })
                    .then(response => response.text())
                    .then(data => {
                        alert('消息发送成功：' + data);
                    })
                    .catch(error => alert('消息发送失败：' + error.message));
            }
            
            // 加载系统信息
            fetch('/api/status')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('systemInfo').innerHTML = 
                        '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
                });
        </script>
    </body>
    </html>
  `);
});

// 启动服务器
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  logger.info(`🎉 拾光豆微信公众号集成服务启动成功！`);
  logger.info(`📡 服务器地址: http://${HOST}:${PORT}`);
  logger.info(`🔌 WebSocket地址: ws://${HOST}:${PORT}`);
  logger.info(`🏥 健康检查: http://${HOST}:${PORT}/health`);
  logger.info(`📊 系统状态: http://${HOST}:${PORT}/api/status`);
  logger.info(`🗄️ 文件数据库模式运行中，数据存储在: ${fileDB.dataDir}`);
  logger.info(`📋 配置指南: 查看 REAL_SERVICE_CONFIG_GUIDE.md`);
});

module.exports = app;
