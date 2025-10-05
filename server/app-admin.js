const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');

// 加载环境变量
dotenv.config();

// 引入配置文件
const { serverConfig, dbConfig, logConfig } = require('./config/config');

// 引入日志工具
const logger = require('./utils/logger');

// 初始化Express应用
const app = express();
const server = http.createServer(app);

// 引入WebSocket工具
const webSocketUtils = require('./utils/webSocketUtils');

// 初始化Socket.io服务器
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// 初始化WebSocket工具
global.webSocketUtils = webSocketUtils;
webSocketUtils.init(io);

// 配置安全中间件
if (process.env.NODE_ENV === 'production') {
  app.use(helmet()); // 添加安全头
}

// 配置CORS
app.use(cors());

// 配置gzip压缩
if (process.env.PRODUCTION_GZIP === 'true') {
  app.use(compression());
}

// 配置body解析
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// 配置HTTP请求日志中间件
app.use(logger.expressLogger);

// 🆓 免费文件数据库（替代MongoDB）
class FreeFileDatabase {
  constructor() {
    const path = require('path');
    const fs = require('fs');
    
    this.dataDir = path.join(__dirname, '../data');
    this.messagesFile = path.join(this.dataDir, 'messages.json');
    this.usersFile = path.join(this.dataDir, 'users.json');
    this.statsFile = path.join(this.dataDir, 'stats.json');
    
    // 确保数据目录存在
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    // 初始化数据文件
    this.initDataFiles();
    this.initStats();
  }
  
  initDataFiles() {
    const fs = require('fs');
    if (!fs.existsSync(this.messagesFile)) {
      fs.writeFileSync(this.messagesFile, JSON.stringify([]));
    }
    if (!fs.existsSync(this.usersFile)) {
      fs.writeFileSync(this.usersFile, JSON.stringify([]));
    }
  }
  
  initStats() {
    const fs = require('fs');
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
  
  readMessages() {
    const fs = require('fs');
    try {
      const data = fs.readFileSync(this.messagesFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('读取消息数据失败', { error: error.message });
      return [];
    }
  }
  
  saveMessages(messages) {
    const fs = require('fs');
    try {
      fs.writeFileSync(this.messagesFile, JSON.stringify(messages, null, 2));
      return true;
    } catch (error) {
      logger.error('保存消息数据失败', { error: error.message });
      return false;
    }
  }
  
  readStats() {
    const fs = require('fs');
    try {
      const data = fs.readFileSync(this.statsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('读取统计信息失败', { error: error.message });
      return this.getDefaultStats();
    }
  }
  
  saveStats(stats) {
    const fs = require('fs');
    try {
      fs.writeFileSync(this.statsFile, JSON.stringify(stats, null, 2));
      return true;
    } catch (error) {
      logger.error('保存统计信息失败', { error: error.message });
      return false;
    }
  }
  
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
  
  getStats() {
    return this.readStats();
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

// 注册路由
const wechatRoutes = require('./routes/wechatRoutes');
const freeTaskRoutes = require('./routes/freeTaskRoutes');

app.use('/wechat', wechatRoutes);
app.use('/tasks', freeTaskRoutes);

// 健康检查接口
app.get('/health', (req, res) => {
  const stats = freeDB.getStats();
  res.status(200).json({ 
    status: 'ok', 
    message: '拾光豆后端系统运行正常（免费模式）',
    mode: 'free-file-database',
    stats: {
      totalMessages: stats.totalMessages,
      freeVoiceRecognitions: stats.freeVoiceRecognitions,
      dailyUsage: stats.dailyUsage
    },
    timestamp: new Date().toISOString()
  });
});

// 系统状态接口
app.get('/api/status', (req, res) => {
  const stats = freeDB.getStats();
  
  res.status(200).json({
    service: '拾光豆后端系统（免费版）',
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

// 统计信息接口
app.get('/api/stats', (req, res) => {
  const stats = freeDB.getStats();
  res.status(200).json({
    success: true,
    data: stats,
    mode: 'free-file-database'
  });
});

// 🎛️ B端管理系统界面
app.get('/', (req, res) => {
  const stats = freeDB.getStats();
  res.send(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>拾光豆 B端管理系统</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #f5f7fa;
                color: #333;
            }
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 1rem 2rem;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header h1 {
                font-size: 1.5rem;
                font-weight: 600;
            }
            .header .subtitle {
                font-size: 0.9rem;
                opacity: 0.9;
                margin-top: 0.25rem;
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 2rem;
            }
            .dashboard {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 1.5rem;
                margin-bottom: 2rem;
            }
            .card {
                background: white;
                border-radius: 12px;
                padding: 1.5rem;
                box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                border: 1px solid #e1e5e9;
            }
            .card h3 {
                color: #2c3e50;
                margin-bottom: 1rem;
                font-size: 1.1rem;
                font-weight: 600;
            }
            .stat-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 1rem;
            }
            .stat-item {
                text-align: center;
                padding: 1rem;
                background: #f8f9fa;
                border-radius: 8px;
            }
            .stat-value {
                font-size: 2rem;
                font-weight: bold;
                color: #667eea;
                margin-bottom: 0.25rem;
            }
            .stat-label {
                font-size: 0.85rem;
                color: #6c757d;
            }
            .actions {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
                margin-top: 1rem;
            }
            .btn {
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: 8px;
                font-size: 0.9rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                text-decoration: none;
                display: inline-block;
                text-align: center;
            }
            .btn-primary {
                background: #667eea;
                color: white;
            }
            .btn-primary:hover {
                background: #5a6fd8;
                transform: translateY(-1px);
            }
            .btn-secondary {
                background: #6c757d;
                color: white;
            }
            .btn-secondary:hover {
                background: #5a6268;
                transform: translateY(-1px);
            }
            .btn-success {
                background: #28a745;
                color: white;
            }
            .btn-success:hover {
                background: #218838;
                transform: translateY(-1px);
            }
            .btn-warning {
                background: #ffc107;
                color: #212529;
            }
            .btn-warning:hover {
                background: #e0a800;
                transform: translateY(-1px);
            }
            .status-indicator {
                display: inline-block;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                margin-right: 0.5rem;
            }
            .status-online {
                background: #28a745;
                animation: pulse 2s infinite;
            }
            .status-offline {
                background: #dc3545;
            }
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }
            .message-list {
                max-height: 300px;
                overflow-y: auto;
                border: 1px solid #e1e5e9;
                border-radius: 8px;
                padding: 1rem;
                background: #f8f9fa;
            }
            .message-item {
                padding: 0.75rem;
                margin-bottom: 0.5rem;
                background: white;
                border-radius: 6px;
                border-left: 4px solid #667eea;
            }
            .message-meta {
                font-size: 0.8rem;
                color: #6c757d;
                margin-bottom: 0.25rem;
            }
            .message-content {
                font-size: 0.9rem;
                color: #333;
            }
            .log-container {
                background: #1e1e1e;
                color: #f8f8f2;
                padding: 1rem;
                border-radius: 8px;
                font-family: 'Monaco', 'Menlo', monospace;
                font-size: 0.8rem;
                max-height: 200px;
                overflow-y: auto;
            }
            .log-entry {
                margin-bottom: 0.25rem;
                padding: 0.25rem 0;
            }
            .log-time {
                color: #6272a4;
            }
            .log-level-info {
                color: #50fa7b;
            }
            .log-level-error {
                color: #ff5555;
            }
            .log-level-warn {
                color: #ffb86c;
            }
            .refresh-btn {
                position: fixed;
                bottom: 2rem;
                right: 2rem;
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: #667eea;
                color: white;
                border: none;
                font-size: 1.5rem;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
                transition: all 0.3s;
            }
            .refresh-btn:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
            }
            .tabs {
                display: flex;
                border-bottom: 2px solid #e1e5e9;
                margin-bottom: 1.5rem;
            }
            .tab {
                padding: 0.75rem 1.5rem;
                cursor: pointer;
                border-bottom: 2px solid transparent;
                transition: all 0.2s;
                font-weight: 500;
            }
            .tab.active {
                border-bottom-color: #667eea;
                color: #667eea;
            }
            .tab-content {
                display: none;
            }
            .tab-content.active {
                display: block;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🎛️ 拾光豆 B端管理系统</h1>
            <div class="subtitle">
                <span class="status-indicator status-online"></span>
                系统运行正常 | 免费模式 | 文件数据库
            </div>
        </div>

        <div class="container">
            <div class="tabs">
                <div class="tab active" onclick="switchTab('dashboard')">📊 仪表盘</div>
                <div class="tab" onclick="switchTab('messages')">💬 消息管理</div>
                <div class="tab" onclick="switchTab('users')">👥 用户管理</div>
                <div class="tab" onclick="switchTab('logs')">📝 系统日志</div>
                <div class="tab" onclick="switchTab('settings')">⚙️ 系统设置</div>
            </div>

            <!-- 仪表盘 -->
            <div id="dashboard" class="tab-content active">
                <div class="dashboard">
                    <div class="card">
                        <h3>📊 系统统计</h3>
                        <div class="stat-grid">
                            <div class="stat-item">
                                <div class="stat-value">${stats.totalMessages}</div>
                                <div class="stat-label">总消息数</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-value">${stats.voiceMessages}</div>
                                <div class="stat-label">语音消息</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-value">${stats.textMessages}</div>
                                <div class="stat-label">文本消息</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-value">${stats.freeVoiceRecognitions}</div>
                                <div class="stat-label">语音识别</div>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <h3>🎯 快速操作</h3>
                        <div class="actions">
                            <button class="btn btn-primary" onclick="testHealth()">健康检查</button>
                            <button class="btn btn-success" onclick="testWebSocket()">WebSocket测试</button>
                            <button class="btn btn-warning" onclick="simulateMessage()">模拟消息</button>
                            <button class="btn btn-secondary" onclick="refreshStats()">刷新统计</button>
                        </div>
                    </div>

                    <div class="card">
                        <h3>📈 今日使用</h3>
                        <div class="stat-grid">
                            <div class="stat-item">
                                <div class="stat-value">${stats.dailyUsage.messages}</div>
                                <div class="stat-label">今日消息</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-value">${stats.dailyUsage.voiceRecognitions}</div>
                                <div class="stat-label">今日识别</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 消息管理 -->
            <div id="messages" class="tab-content">
                <div class="card">
                    <h3>💬 消息管理</h3>
                    <div class="actions">
                        <button class="btn btn-primary" onclick="loadMessages()">加载消息</button>
                        <button class="btn btn-success" onclick="searchMessages()">搜索消息</button>
                        <button class="btn btn-warning" onclick="exportMessages()">导出数据</button>
                    </div>
                    <div id="messageList" class="message-list">
                        <div style="text-align: center; color: #6c757d; padding: 2rem;">
                            点击"加载消息"查看消息列表
                        </div>
                    </div>
                </div>
            </div>

            <!-- 用户管理 -->
            <div id="users" class="tab-content">
                <div class="card">
                    <h3>👥 用户管理</h3>
                    <div class="actions">
                        <button class="btn btn-primary" onclick="loadUsers()">加载用户</button>
                        <button class="btn btn-success" onclick="addUser()">添加用户</button>
                        <button class="btn btn-warning" onclick="userStats()">用户统计</button>
                    </div>
                    <div id="userList" class="message-list">
                        <div style="text-align: center; color: #6c757d; padding: 2rem;">
                            点击"加载用户"查看用户列表
                        </div>
                    </div>
                </div>
            </div>

            <!-- 系统日志 -->
            <div id="logs" class="tab-content">
                <div class="card">
                    <h3>📝 系统日志</h3>
                    <div class="actions">
                        <button class="btn btn-primary" onclick="loadLogs()">加载日志</button>
                        <button class="btn btn-secondary" onclick="clearLogs()">清空日志</button>
                        <button class="btn btn-warning" onclick="downloadLogs()">下载日志</button>
                    </div>
                    <div id="logContainer" class="log-container">
                        <div class="log-entry">
                            <span class="log-time">[${new Date().toLocaleTimeString()}]</span>
                            <span class="log-level-info">[INFO]</span>
                            系统启动完成
                        </div>
                    </div>
                </div>
            </div>

            <!-- 系统设置 -->
            <div id="settings" class="tab-content">
                <div class="card">
                    <h3>⚙️ 系统设置</h3>
                    <div class="actions">
                        <button class="btn btn-primary" onclick="systemInfo()">系统信息</button>
                        <button class="btn btn-success" onclick="backupData()">备份数据</button>
                        <button class="btn btn-warning" onclick="resetStats()">重置统计</button>
                        <button class="btn btn-secondary" onclick="restartService()">重启服务</button>
                    </div>
                    <div id="settingsInfo" style="margin-top: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
                        <h4>系统配置信息</h4>
                        <p><strong>服务模式:</strong> 免费文件数据库模式</p>
                        <p><strong>语音识别:</strong> 微信自带识别（完全免费）</p>
                        <p><strong>数据存储:</strong> ${freeDB.dataDir}</p>
                        <p><strong>WebSocket:</strong> ws://localhost:3000</p>
                    </div>
                </div>
            </div>
        </div>

        <button class="refresh-btn" onclick="refreshAll()" title="刷新所有数据">🔄</button>

        <script>
            let ws = null;
            let currentTab = 'dashboard';

            function switchTab(tabName) {
                // 隐藏所有标签内容
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                
                // 移除所有标签的激活状态
                document.querySelectorAll('.tab').forEach(tab => {
                    tab.classList.remove('active');
                });
                
                // 显示选中的标签内容
                document.getElementById(tabName).classList.add('active');
                
                // 激活选中的标签
                event.target.classList.add('active');
                
                currentTab = tabName;
            }

            function testHealth() {
                fetch('/health')
                    .then(response => response.json())
                    .then(data => {
                        alert('健康检查成功：\\n' + JSON.stringify(data, null, 2));
                    })
                    .catch(error => alert('健康检查失败：' + error.message));
            }

            function testWebSocket() {
                if (ws) {
                    ws.close();
                }
                
                ws = new WebSocket('ws://localhost:3000');
                
                ws.onopen = () => {
                    alert('WebSocket连接成功！');
                    addLog('WebSocket连接建立', 'info');
                };
                
                ws.onmessage = (event) => {
                    addLog('收到消息: ' + event.data, 'info');
                };
                
                ws.onerror = (error) => {
                    alert('WebSocket连接失败：' + error.message);
                    addLog('WebSocket连接失败', 'error');
                };
                
                ws.onclose = () => {
                    addLog('WebSocket连接关闭', 'warn');
                };
            }

            function simulateMessage() {
                const message = {
                    user_id: 'admin_' + Date.now(),
                    content_type: 'text',
                    raw_content: '管理员测试消息',
                    converted_text: '管理员测试消息'
                };
                
                fetch('/wechat/message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/xml' },
                    body: '<xml><FromUserName>' + message.user_id + '</FromUserName><ToUserName>service</ToUserName><Content>' + message.raw_content + '</Content></xml>'
                })
                    .then(response => response.text())
                    .then(data => {
                        alert('消息发送成功！');
                        addLog('模拟消息发送成功', 'info');
                        refreshStats();
                    })
                    .catch(error => {
                        alert('消息发送失败：' + error.message);
                        addLog('模拟消息发送失败: ' + error.message, 'error');
                    });
            }

            function refreshStats() {
                fetch('/api/stats')
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            location.reload();
                        }
                    })
                    .catch(error => {
                        addLog('刷新统计失败: ' + error.message, 'error');
                    });
            }

            function loadMessages() {
                fetch('/tasks/wechat?userId=all&limit=20')
                    .then(response => response.json())
                    .then(data => {
                        const container = document.getElementById('messageList');
                        if (data.success && data.data.length > 0) {
                            container.innerHTML = data.data.map(msg => 
                                '<div class="message-item">' +
                                    '<div class="message-meta">' + msg.user_id + ' | ' + msg.content_type + ' | ' + new Date(msg.created_at).toLocaleString() + '</div>' +
                                    '<div class="message-content">' + (msg.converted_text || msg.raw_content) + '</div>' +
                                '</div>'
                            ).join('');
                        } else {
                            container.innerHTML = '<div style="text-align: center; color: #6c757d; padding: 2rem;">暂无消息数据</div>';
                        }
                    })
                    .catch(error => {
                        document.getElementById('messageList').innerHTML = '<div style="text-align: center; color: #dc3545; padding: 2rem;">加载失败: ' + error.message + '</div>';
                    });
            }

            function searchMessages() {
                const keyword = prompt('请输入搜索关键词:');
                if (keyword) {
                    fetch('/tasks/wechat/search?userId=all&keyword=' + encodeURIComponent(keyword))
                        .then(response => response.json())
                        .then(data => {
                            const container = document.getElementById('messageList');
                            if (data.success && data.data.length > 0) {
                                container.innerHTML = data.data.map(msg => 
                                    '<div class="message-item">' +
                                        '<div class="message-meta">' + msg.user_id + ' | ' + msg.content_type + ' | ' + new Date(msg.created_at).toLocaleString() + '</div>' +
                                        '<div class="message-content">' + (msg.converted_text || msg.raw_content) + '</div>' +
                                    '</div>'
                                ).join('');
                            } else {
                                container.innerHTML = '<div style="text-align: center; color: #6c757d; padding: 2rem;">未找到相关消息</div>';
                            }
                        })
                        .catch(error => {
                            document.getElementById('messageList').innerHTML = '<div style="text-align: center; color: #dc3545; padding: 2rem;">搜索失败: ' + error.message + '</div>';
                        });
                }
            }

            function exportMessages() {
                fetch('/tasks/wechat?userId=all&limit=1000')
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'messages_' + new Date().toISOString().split('T')[0] + '.json';
                            a.click();
                            URL.revokeObjectURL(url);
                            addLog('消息数据导出成功', 'info');
                        }
                    })
                    .catch(error => {
                        addLog('消息数据导出失败: ' + error.message, 'error');
                    });
            }

            function loadUsers() {
                document.getElementById('userList').innerHTML = '<div style="text-align: center; color: #6c757d; padding: 2rem;">用户管理功能开发中...</div>';
            }

            function addUser() {
                alert('添加用户功能开发中...');
            }

            function userStats() {
                alert('用户统计功能开发中...');
            }

            function loadLogs() {
                addLog('加载系统日志', 'info');
            }

            function clearLogs() {
                document.getElementById('logContainer').innerHTML = '';
                addLog('日志已清空', 'warn');
            }

            function downloadLogs() {
                const logs = document.getElementById('logContainer').innerText;
                const blob = new Blob([logs], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'logs_' + new Date().toISOString().split('T')[0] + '.txt';
                a.click();
                URL.revokeObjectURL(url);
                addLog('日志下载成功', 'info');
            }

            function systemInfo() {
                fetch('/api/status')
                    .then(response => response.json())
                    .then(data => {
                        alert('系统信息：\\n' + JSON.stringify(data, null, 2));
                    })
                    .catch(error => alert('获取系统信息失败：' + error.message));
            }

            function backupData() {
                alert('数据备份功能开发中...');
            }

            function resetStats() {
                if (confirm('确定要重置统计信息吗？此操作不可恢复！')) {
                    alert('重置统计功能开发中...');
                }
            }

            function restartService() {
                if (confirm('确定要重启服务吗？')) {
                    alert('服务重启功能开发中...');
                }
            }

            function addLog(message, level = 'info') {
                const container = document.getElementById('logContainer');
                const time = new Date().toLocaleTimeString();
                const levelClass = 'log-level-' + level;
                const entry = document.createElement('div');
                entry.className = 'log-entry';
                entry.innerHTML = '<span class="log-time">[' + time + ']</span> <span class="' + levelClass + '">[' + level.toUpperCase() + ']</span> ' + message;
                container.appendChild(entry);
                container.scrollTop = container.scrollHeight;
            }

            function refreshAll() {
                location.reload();
            }

            // 页面加载完成后自动连接WebSocket
            window.onload = function() {
                addLog('B端管理系统加载完成', 'info');
                testWebSocket();
            };
        </script>
    </body>
    </html>
  `);
});

// 全局错误处理中间件
app.use((err, req, res, next) => {
  logger.error('全局错误处理', { error: err.message, stack: err.stack });
  res.status(500).json({ 
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : '服务器错误'
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: '接口不存在',
    path: req.originalUrl,
    method: req.method
  });
});

// 启动服务器
const PORT = serverConfig.port;
const HOST = serverConfig.host;

server.listen(PORT, HOST, () => {
  logger.info(`🎛️ 拾光豆B端管理系统启动成功！`);
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

module.exports = app;
