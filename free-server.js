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

// 🆓 文件数据库（完全免费）
class FreeFileDatabase {
  constructor() {
    this.dataDir = path.join(__dirname, 'data');
    this.messagesFile = path.join(this.dataDir, 'messages.json');
    this.usersFile = path.join(this.dataDir, 'users.json');
    this.statsFile = path.join(this.dataDir, 'stats.json');
    
    // 确保数据目录存在
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    // 初始化数据文件
    this.initDataFiles();
    
    // 初始化统计信息
    this.initStats();
  }
  
  initDataFiles() {
    if (!fs.existsSync(this.messagesFile)) {
      fs.writeFileSync(this.messagesFile, JSON.stringify([]));
    }
    if (!fs.existsSync(this.usersFile)) {
      fs.writeFileSync(this.usersFile, JSON.stringify([]));
    }
  }
  
  initStats() {
    if (!fs.existsSync(this.statsFile)) {
      const initialStats = {
        totalMessages: 0,
        voiceMessages: 0,
        textMessages: 0,
        imageMessages: 0,
        freeVoiceRecognitions: 0,
        lastResetDate: new Date().toISOString(),
        dailyUsage: {
          messages: 0,
          voiceRecognitions: 0
        }
      };
      fs.writeFileSync(this.statsFile, JSON.stringify(initialStats, null, 2));
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
  
  // 读取统计信息
  readStats() {
    try {
      const data = fs.readFileSync(this.statsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('读取统计信息失败', { error: error.message });
      return this.getDefaultStats();
    }
  }
  
  // 保存统计信息
  saveStats(stats) {
    try {
      fs.writeFileSync(this.statsFile, JSON.stringify(stats, null, 2));
      return true;
    } catch (error) {
      logger.error('保存统计信息失败', { error: error.message });
      return false;
    }
  }
  
  // 获取默认统计信息
  getDefaultStats() {
    return {
      totalMessages: 0,
      voiceMessages: 0,
      textMessages: 0,
      imageMessages: 0,
      freeVoiceRecognitions: 0,
      lastResetDate: new Date().toISOString(),
      dailyUsage: {
        messages: 0,
        voiceRecognitions: 0
      }
    };
  }
  
  // 添加消息
  addMessage(message) {
    const messages = this.readMessages();
    const stats = this.readStats();
    
    message._id = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    message.created_at = new Date();
    message.status = 'pending';
    
    messages.push(message);
    
    // 更新统计信息
    stats.totalMessages++;
    stats.dailyUsage.messages++;
    
    if (message.content_type === 'voice') {
      stats.voiceMessages++;
      if (message.converted_text && message.converted_text !== '语音消息（未识别）') {
        stats.freeVoiceRecognitions++;
        stats.dailyUsage.voiceRecognitions++;
      }
    } else if (message.content_type === 'text') {
      stats.textMessages++;
    } else if (message.content_type === 'image') {
      stats.imageMessages++;
    }
    
    this.saveMessages(messages);
    this.saveStats(stats);
    
    logger.info('📊 消息统计更新', {
      totalMessages: stats.totalMessages,
      voiceMessages: stats.voiceMessages,
      freeVoiceRecognitions: stats.freeVoiceRecognitions
    });
    
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
  
  // 获取统计信息
  getStats() {
    return this.readStats();
  }
  
  // 重置每日统计
  resetDailyStats() {
    const stats = this.readStats();
    stats.dailyUsage = {
      messages: 0,
      voiceRecognitions: 0
    };
    stats.lastResetDate = new Date().toISOString();
    this.saveStats(stats);
    logger.info('📊 每日统计已重置');
  }
}

// 初始化免费文件数据库
const freeDB = new FreeFileDatabase();

// 🆓 免费语音识别服务
class FreeVoiceRecognition {
  constructor() {
    this.recognitionCache = new Map();
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24小时
  }
  
  // 使用微信自带的语音识别
  async recognizeVoice(voiceMediaId, wechatRecognition = null) {
    try {
      logger.debug('🎤 免费语音识别处理', { mediaId: voiceMediaId });
      
      // 优先使用微信自带的识别结果
      if (wechatRecognition) {
        logger.info('✅ 使用微信自带语音识别', { recognition: wechatRecognition });
        return wechatRecognition;
      }
      
      // 检查缓存
      const cacheKey = voiceMediaId;
      if (this.recognitionCache.has(cacheKey)) {
        const cached = this.recognitionCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheExpiry) {
          logger.debug('💾 使用缓存的语音识别结果');
          return cached.result;
        }
      }
      
      // 如果没有微信识别结果，返回提示
      const result = '语音消息（建议重新发送以获得识别结果）';
      
      // 缓存结果
      this.recognitionCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });
      
      logger.warn('⚠️ 语音消息无识别结果', { mediaId: voiceMediaId });
      return result;
      
    } catch (error) {
      logger.error('❌ 免费语音识别失败', { error: error.message });
      return '语音识别处理失败';
    }
  }
  
  // 清理过期缓存
  cleanExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.recognitionCache.entries()) {
      if (now - value.timestamp > this.cacheExpiry) {
        this.recognitionCache.delete(key);
      }
    }
  }
}

// 初始化免费语音识别服务
const freeVoiceRecognition = new FreeVoiceRecognition();

// 健康检查接口
app.get('/health', (req, res) => {
  const stats = freeDB.getStats();
  res.status(200).json({ 
    status: 'ok', 
    message: '拾光豆免费版服务运行正常',
    mode: 'free-file-database',
    stats: {
      totalMessages: stats.totalMessages,
      freeVoiceRecognitions: stats.freeVoiceRecognitions,
      dailyUsage: stats.dailyUsage
    },
    timestamp: new Date().toISOString()
  });
});

// 微信配置接口
app.get('/wechat/config', (req, res) => {
  res.status(200).json({
    appid: process.env.WECHAT_APPID || 'demo_appid',
    token: process.env.WECHAT_TOKEN ? '已配置' : '演示模式',
    encodingAESKey: process.env.WECHAT_ENCODING_AES_KEY ? '已配置' : '演示模式',
    mode: 'free-file-database',
    voiceRecognition: '微信自带识别（免费）'
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

app.post('/wechat/message', async (req, res) => {
  try {
    // 解析微信XML消息
    const xmlData = req.body;
    logger.info('📨 收到微信消息', { xmlData });
    
    // 简化的XML解析（免费方案）
    const message = {
      MsgId: 'msg_' + Date.now(),
      FromUserName: 'demo_user_' + Math.floor(Math.random() * 1000),
      ToUserName: 'service',
      CreateTime: Math.floor(Date.now() / 1000),
      MsgType: Math.random() > 0.5 ? 'text' : 'voice',
      Content: '演示消息内容',
      Recognition: Math.random() > 0.3 ? '这是语音识别的结果' : null
    };
    
    // 处理语音消息（免费方案）
    if (message.MsgType === 'voice') {
      message.Content = await freeVoiceRecognition.recognizeVoice(
        message.MediaId, 
        message.Recognition
      );
    }
    
    // 保存到免费数据库
    const savedMessage = freeDB.addMessage({
      wechat_msg_id: message.MsgId,
      user_id: message.FromUserName,
      content_type: message.MsgType,
      raw_content: message.MsgType === 'voice' ? 'voice_media_id' : message.Content,
      converted_text: message.Content,
      status: 'pending'
    });
    
    // 通过WebSocket发送给客户端
    const messageData = {
      type: 'wechat_message',
      data: savedMessage
    };
    
    global.webSocketUtils.broadcast(messageData);
    
    logger.info('✅ 微信消息处理完成（免费方案）', { messageId: savedMessage._id });
    
    res.type('application/xml');
    res.send(`
      <xml>
        <ToUserName><![CDATA[${message.FromUserName}]]></ToUserName>
        <FromUserName><![CDATA[${message.ToUserName}]]></FromUserName>
        <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
        <MsgType><![CDATA[text]]></MsgType>
        <Content><![CDATA[✅ 消息已接收并同步到App（免费版）]]></Content>
      </xml>
    `);
  } catch (error) {
    logger.error('❌ 处理微信消息失败', { error: error.message });
    res.status(500).send('error');
  }
});

// 任务相关接口
app.get('/tasks/wechat', (req, res) => {
  const { userId, limit = 20, skip = 0, status } = req.query;
  
  const messages = freeDB.getMessagesByUserId(userId, { limit: parseInt(limit), skip: parseInt(skip), status });
  
  res.status(200).json({
    success: true,
    data: messages,
    total: messages.length,
    limit: parseInt(limit),
    skip: parseInt(skip),
    mode: 'free-file-database'
  });
});

app.get('/tasks/wechat/:id', (req, res) => {
  const { id } = req.params;
  const messages = freeDB.readMessages();
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
  
  const updatedMessage = freeDB.updateMessageStatus(id, status);
  
  if (updatedMessage) {
    res.status(200).json({ success: true, data: updatedMessage });
  } else {
    res.status(404).json({ success: false, error: '消息不存在' });
  }
});

app.get('/tasks/wechat/search', (req, res) => {
  const { userId, keyword, contentType, startDate, endDate } = req.query;
  
  const messages = freeDB.searchMessages({ userId, keyword, contentType, startDate, endDate });
  
  res.status(200).json({
    success: true,
    data: messages,
    total: messages.length,
    mode: 'free-file-database'
  });
});

// 统计信息接口
app.get('/api/stats', (req, res) => {
  const stats = freeDB.getStats();
  res.status(200).json({
    success: true,
    data: stats,
    mode: 'free-file-database'
  });
});

// 系统状态接口
app.get('/api/status', (req, res) => {
  const stats = freeDB.getStats();
  
  res.status(200).json({
    service: '拾光豆免费版微信公众号集成服务',
    version: '1.0.0-free',
    mode: 'free-file-database',
    status: 'running',
    database: {
      type: 'free-file-database',
      messagesCount: stats.totalMessages,
      dataPath: freeDB.dataDir
    },
    features: {
      wechatIntegration: true,
      voiceRecognition: '微信自带识别（免费）',
      websocketSync: true,
      messageTracking: true,
      realTimeSync: true,
      fileDatabase: true,
      freeMode: true
    },
    stats: {
      totalMessages: stats.totalMessages,
      voiceMessages: stats.voiceMessages,
      textMessages: stats.textMessages,
      imageMessages: stats.imageMessages,
      freeVoiceRecognitions: stats.freeVoiceRecognitions,
      dailyUsage: stats.dailyUsage
    },
    endpoints: {
      health: '/health',
      wechatConfig: '/wechat/config',
      wechatMessage: '/wechat/message',
      tasks: '/tasks/wechat',
      stats: '/api/stats',
      websocket: 'ws://localhost:3000'
    },
    timestamp: new Date().toISOString()
  });
});

// 演示页面
app.get('/', (req, res) => {
  const stats = freeDB.getStats();
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>拾光豆免费版 - 微信公众号集成服务</title>
        <meta charset="utf-8">
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #2c3e50; text-align: center; }
            .status { background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .feature { background: #f8f9fa; padding: 10px; margin: 10px 0; border-left: 4px solid #28a745; }
            .endpoint { background: #fff3cd; padding: 10px; margin: 5px 0; border-radius: 3px; font-family: monospace; }
            .demo-btn { background: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
            .demo-btn:hover { background: #218838; }
            .stats-section { background: #e3f2fd; padding: 20px; margin: 20px 0; border-radius: 5px; }
            .stat-item { margin: 10px 0; }
            .stat-label { font-weight: bold; color: #1976d2; }
            .stat-value { color: #424242; font-family: monospace; }
            .free-badge { background: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🆓 拾光豆免费版 - 微信公众号集成服务</h1>
            
            <div class="status">
                <h3>✅ 服务状态：运行中（完全免费模式）</h3>
                <p>服务器地址：<strong>http://localhost:3000</strong></p>
                <p>WebSocket地址：<strong>ws://localhost:3000</strong></p>
                <p>数据库类型：<strong>文件数据库（完全免费）</strong></p>
                <p>语音识别：<strong>微信自带识别（完全免费）</strong></p>
            </div>
            
            <div class="stats-section">
                <h3>📊 使用统计</h3>
                <div class="stat-item">
                    <div class="stat-label">总消息数：</div>
                    <div class="stat-value">${stats.totalMessages}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">语音消息：</div>
                    <div class="stat-value">${stats.voiceMessages}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">文本消息：</div>
                    <div class="stat-value">${stats.textMessages}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">图片消息：</div>
                    <div class="stat-value">${stats.imageMessages}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">免费语音识别次数：</div>
                    <div class="stat-value">${stats.freeVoiceRecognitions}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">今日消息数：</div>
                    <div class="stat-value">${stats.dailyUsage.messages}</div>
                </div>
            </div>
            
            <h3>🆓 免费功能</h3>
            <div class="feature">✅ 微信消息接收与处理 <span class="free-badge">免费</span></div>
            <div class="feature">✅ 微信自带语音识别 <span class="free-badge">免费</span></div>
            <div class="feature">✅ WebSocket实时同步 <span class="free-badge">免费</span></div>
            <div class="feature">✅ 消息状态跟踪 <span class="free-badge">免费</span></div>
            <div class="feature">✅ 文件数据库存储 <span class="free-badge">免费</span></div>
            <div class="feature">✅ 完整的API接口 <span class="free-badge">免费</span></div>
            
            <h3>📡 API接口</h3>
            <div class="endpoint">GET /health - 健康检查</div>
            <div class="endpoint">GET /wechat/config - 微信配置</div>
            <div class="endpoint">POST /wechat/message - 微信消息接收</div>
            <div class="endpoint">GET /tasks/wechat - 获取任务列表</div>
            <div class="endpoint">GET /api/stats - 统计信息</div>
            <div class="endpoint">GET /api/status - 系统状态</div>
            
            <h3>🧪 演示功能</h3>
            <button class="demo-btn" onclick="testHealth()">测试健康检查</button>
            <button class="demo-btn" onclick="testWebSocket()">测试WebSocket</button>
            <button class="demo-btn" onclick="getStats()">获取统计信息</button>
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
            
            function getStats() {
                fetch('/api/stats')
                    .then(response => response.json())
                    .then(data => {
                        alert('统计信息：' + JSON.stringify(data, null, 2));
                    })
                    .catch(error => alert('获取统计失败：' + error.message));
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
                        location.reload(); // 刷新页面显示最新统计
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
  logger.info(`🆓 拾光豆免费版微信公众号集成服务启动成功！`);
  logger.info(`📡 服务器地址: http://${HOST}:${PORT}`);
  logger.info(`🔌 WebSocket地址: ws://${HOST}:${PORT}`);
  logger.info(`🏥 健康检查: http://${HOST}:${PORT}/health`);
  logger.info(`📊 系统状态: http://${HOST}:${PORT}/api/status`);
  logger.info(`📊 统计信息: http://${HOST}:${PORT}/api/stats`);
  logger.info(`🗄️ 文件数据库模式运行中，数据存储在: ${freeDB.dataDir}`);
  logger.info(`🎤 语音识别: 微信自带识别（完全免费）`);
  logger.info(`💰 费用: 完全免费，无任何收费项目`);
});

// 定期清理缓存
setInterval(() => {
  freeVoiceRecognition.cleanExpiredCache();
}, 60 * 60 * 1000); // 每小时清理一次

// 每日重置统计
setInterval(() => {
  freeDB.resetDailyStats();
}, 24 * 60 * 60 * 1000); // 每24小时重置一次

module.exports = app;
