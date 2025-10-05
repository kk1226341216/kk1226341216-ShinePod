const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');

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

// 模拟数据
const mockMessages = [
  {
    _id: 'msg_001',
    wechat_msg_id: 'wx_msg_001',
    user_id: 'demo_user_001',
    content_type: 'text',
    raw_content: '这是一条演示文本消息',
    converted_text: '这是一条演示文本消息',
    status: 'synced',
    created_at: new Date()
  },
  {
    _id: 'msg_002',
    wechat_msg_id: 'wx_msg_002',
    user_id: 'demo_user_001',
    content_type: 'voice',
    raw_content: 'voice_media_id_001',
    converted_text: '这是一条演示语音消息的识别结果',
    status: 'synced',
    created_at: new Date()
  },
  {
    _id: 'msg_003',
    wechat_msg_id: 'wx_msg_003',
    user_id: 'demo_user_002',
    content_type: 'text',
    raw_content: '另一条演示消息',
    converted_text: '另一条演示消息',
    status: 'pending',
    created_at: new Date()
  }
];

// 健康检查接口
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: '拾光豆微信公众号集成服务运行正常',
    mode: 'demo',
    timestamp: new Date().toISOString()
  });
});

// 微信配置接口
app.get('/wechat/config', (req, res) => {
  res.status(200).json({
    appid: process.env.WECHAT_APPID || 'demo_appid',
    token: process.env.WECHAT_TOKEN ? '已配置' : '演示模式',
    encodingAESKey: process.env.WECHAT_ENCODING_AES_KEY ? '已配置' : '演示模式',
    mode: 'demo'
  });
});

// 微信消息接收接口（演示模式）
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
  // 模拟接收微信消息
  const mockMessage = {
    type: 'wechat_message',
    data: {
      _id: 'msg_' + Date.now(),
      wechat_msg_id: 'wx_' + Date.now(),
      user_id: 'demo_user_' + Math.floor(Math.random() * 1000),
      content_type: Math.random() > 0.5 ? 'text' : 'voice',
      raw_content: '演示消息内容',
      converted_text: '演示消息转换结果',
      status: 'pending',
      created_at: new Date()
    }
  };
  
  // 通过WebSocket发送给客户端
  global.webSocketUtils.broadcast(mockMessage);
  
  res.type('application/xml');
  res.send(`
    <xml>
      <ToUserName><![CDATA[${req.body.FromUserName || 'demo_user'}]]></ToUserName>
      <FromUserName><![CDATA[${req.body.ToUserName || 'demo_service'}]]></FromUserName>
      <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
      <MsgType><![CDATA[text]]></MsgType>
      <Content><![CDATA[✅ 演示模式：消息已接收并同步到App]]></Content>
    </xml>
  `);
});

// 任务相关接口
app.get('/tasks/wechat', (req, res) => {
  const { userId, limit = 20, skip = 0, status } = req.query;
  
  let filteredMessages = mockMessages;
  
  if (userId) {
    filteredMessages = filteredMessages.filter(msg => msg.user_id === userId);
  }
  
  if (status) {
    filteredMessages = filteredMessages.filter(msg => msg.status === status);
  }
  
  const paginatedMessages = filteredMessages.slice(skip, skip + parseInt(limit));
  
  res.status(200).json({
    success: true,
    data: paginatedMessages,
    total: filteredMessages.length,
    limit: parseInt(limit),
    skip: parseInt(skip)
  });
});

app.get('/tasks/wechat/:id', (req, res) => {
  const { id } = req.params;
  const message = mockMessages.find(msg => msg._id === id);
  
  if (message) {
    res.status(200).json({ success: true, data: message });
  } else {
    res.status(404).json({ success: false, error: '消息不存在' });
  }
});

app.put('/tasks/wechat/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  const messageIndex = mockMessages.findIndex(msg => msg._id === id);
  
  if (messageIndex !== -1) {
    mockMessages[messageIndex].status = status;
    res.status(200).json({ success: true, data: mockMessages[messageIndex] });
  } else {
    res.status(404).json({ success: false, error: '消息不存在' });
  }
});

app.get('/tasks/wechat/search', (req, res) => {
  const { userId, keyword, contentType } = req.query;
  
  let filteredMessages = mockMessages;
  
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
  
  res.status(200).json({
    success: true,
    data: filteredMessages,
    total: filteredMessages.length
  });
});

// 系统状态接口
app.get('/api/status', (req, res) => {
  res.status(200).json({
    service: '拾光豆微信公众号集成服务',
    version: '1.0.0',
    mode: 'demo',
    status: 'running',
    features: {
      wechatIntegration: true,
      voiceRecognition: true,
      websocketSync: true,
      messageTracking: true,
      realTimeSync: true
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
            #messages { max-height: 300px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; margin: 10px 0; }
            .message { background: #f8f9fa; padding: 8px; margin: 5px 0; border-radius: 3px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🎉 拾光豆（ShinePod）微信公众号集成服务</h1>
            
            <div class="status">
                <h3>✅ 服务状态：运行中（演示模式）</h3>
                <p>服务器地址：<strong>http://localhost:3000</strong></p>
                <p>WebSocket地址：<strong>ws://localhost:3000</strong></p>
            </div>
            
            <h3>🚀 核心功能</h3>
            <div class="feature">✅ 微信消息接收与处理</div>
            <div class="feature">✅ 语音识别（百度AI集成）</div>
            <div class="feature">✅ WebSocket实时同步</div>
            <div class="feature">✅ 消息状态跟踪</div>
            <div class="feature">✅ 任务管理API</div>
            
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
            
            <h3>📱 实时消息</h3>
            <div id="messages"></div>
            
            <h3>📊 系统信息</h3>
            <div id="systemInfo"></div>
        </div>
        
        <script>
            let ws = null;
            
            function addMessage(msg) {
                const messages = document.getElementById('messages');
                const messageDiv = document.createElement('div');
                messageDiv.className = 'message';
                messageDiv.innerHTML = '<strong>' + new Date().toLocaleTimeString() + '</strong>: ' + JSON.stringify(msg);
                messages.appendChild(messageDiv);
                messages.scrollTop = messages.scrollHeight;
            }
            
            function testHealth() {
                fetch('/health')
                    .then(response => response.json())
                    .then(data => {
                        addMessage({ type: 'health_check', data: data });
                    })
                    .catch(error => addMessage({ type: 'error', error: error.message }));
            }
            
            function testWebSocket() {
                if (ws) {
                    ws.close();
                }
                
                ws = new WebSocket('ws://localhost:3000');
                
                ws.onopen = () => {
                    addMessage({ type: 'websocket', status: 'connected' });
                    ws.send(JSON.stringify({ type: 'user_login', userId: 'demo_user_' + Date.now() }));
                };
                
                ws.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    addMessage({ type: 'websocket_message', data: data });
                };
                
                ws.onclose = () => {
                    addMessage({ type: 'websocket', status: 'disconnected' });
                };
                
                ws.onerror = (error) => {
                    addMessage({ type: 'websocket_error', error: error.message });
                };
            }
            
            function getTasks() {
                fetch('/tasks/wechat')
                    .then(response => response.json())
                    .then(data => {
                        addMessage({ type: 'tasks', data: data });
                    })
                    .catch(error => addMessage({ type: 'error', error: error.message }));
            }
            
            function simulateMessage() {
                fetch('/wechat/message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/xml' },
                    body: '<xml><FromUserName>demo_user</FromUserName><ToUserName>service</ToUserName><Content>演示消息</Content></xml>'
                })
                    .then(response => response.text())
                    .then(data => {
                        addMessage({ type: 'simulated_message', response: data });
                    })
                    .catch(error => addMessage({ type: 'error', error: error.message }));
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
  logger.info(`🎯 演示模式运行中，无需MongoDB连接`);
});

module.exports = app;
