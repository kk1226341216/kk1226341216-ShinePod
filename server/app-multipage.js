const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// 加载环境变量
dotenv.config();

// 引入配置文件
const { serverConfig } = require('./config/config');

// 初始化Express应用
const app = express();
const server = http.createServer(app);

// 配置CORS
app.use(cors());

// 配置body解析
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// 🆓 完整功能文件数据库
class CompleteFileDatabase {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.messagesFile = path.join(this.dataDir, 'messages.json');
    this.usersFile = path.join(this.dataDir, 'users.json');
    this.statsFile = path.join(this.dataDir, 'stats.json');
    this.settingsFile = path.join(this.dataDir, 'settings.json');
    this.logsFile = path.join(this.dataDir, 'logs.json');
    
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    this.initDataFiles();
    this.initStats();
    this.initSettings();
    this.initLogs();
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
        totalUsers: 0,
        activeUsers: 0,
        lastResetDate: new Date().toISOString(),
        dailyUsage: {
          messages: 0,
          voiceRecognitions: 0,
          newUsers: 0
        },
        hourlyStats: Array.from({length: 24}, (_, i) => ({
          hour: i,
          messages: 0,
          users: 0
        })),
        weeklyStats: Array.from({length: 7}, (_, i) => ({
          day: i,
          messages: 0,
          users: 0
        }))
      };
      fs.writeFileSync(this.statsFile, JSON.stringify(initialStats, null, 2));
    }
  }
  
  initSettings() {
    if (!fs.existsSync(this.settingsFile)) {
      const initialSettings = {
        systemName: '拾光豆管理系统',
        version: '2.0.0',
        maxMessagesPerUser: 1000,
        maxUsers: 10000,
        autoBackup: true,
        backupInterval: 24,
        logLevel: 'info',
        features: {
          voiceRecognition: true,
          messageSearch: true,
          userManagement: true,
          dataExport: true,
          realTimeSync: true
        }
      };
      fs.writeFileSync(this.settingsFile, JSON.stringify(initialSettings, null, 2));
    }
  }
  
  initLogs() {
    if (!fs.existsSync(this.logsFile)) {
      fs.writeFileSync(this.logsFile, JSON.stringify([]));
    }
  }
  
  readMessages() {
    try {
      const data = fs.readFileSync(this.messagesFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }
  
  saveMessages(messages) {
    try {
      fs.writeFileSync(this.messagesFile, JSON.stringify(messages, null, 2));
      return true;
    } catch (error) {
      return false;
    }
  }
  
  addMessage(message) {
    const messages = this.readMessages();
    const stats = this.readStats();
    
    message._id = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    message.created_at = new Date();
    message.status = 'pending';
    
    messages.push(message);
    
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
    this.addLog('info', `新消息添加: ${message.user_id} - ${message.content_type}`);
    
    return message;
  }
  
  readStats() {
    try {
      const data = fs.readFileSync(this.statsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return this.getDefaultStats();
    }
  }
  
  saveStats(stats) {
    try {
      fs.writeFileSync(this.statsFile, JSON.stringify(stats, null, 2));
      return true;
    } catch (error) {
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
      totalUsers: 0,
      activeUsers: 0,
      lastResetDate: new Date().toISOString(),
      dailyUsage: {
        messages: 0,
        voiceRecognitions: 0,
        newUsers: 0
      },
      hourlyStats: Array.from({length: 24}, (_, i) => ({
        hour: i,
        messages: 0,
        users: 0
      })),
      weeklyStats: Array.from({length: 7}, (_, i) => ({
        day: i,
        messages: 0,
        users: 0
      }))
    };
  }
  
  readUsers() {
    try {
      const data = fs.readFileSync(this.usersFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }
  
  addUser(userData) {
    const users = this.readUsers();
    const stats = this.readStats();
    
    const user = {
      _id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      ...userData,
      created_at: new Date(),
      last_active: new Date(),
      status: 'active',
      message_count: 0
    };
    
    users.push(user);
    
    stats.totalUsers++;
    stats.activeUsers++;
    stats.dailyUsage.newUsers++;
    
    this.saveUsers(users);
    this.saveStats(stats);
    this.addLog('info', `新用户添加: ${user.username || user.user_id}`);
    
    return user;
  }
  
  saveUsers(users) {
    try {
      fs.writeFileSync(this.usersFile, JSON.stringify(users, null, 2));
      return true;
    } catch (error) {
      return false;
    }
  }
  
  readLogs() {
    try {
      const data = fs.readFileSync(this.logsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }
  
  addLog(level, message, details = null) {
    const logs = this.readLogs();
    const logEntry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      level,
      message,
      details,
      timestamp: new Date(),
      ip: '127.0.0.1'
    };
    
    logs.push(logEntry);
    
    if (logs.length > 1000) {
      logs.splice(0, logs.length - 1000);
    }
    
    this.saveLogs(logs);
    return logEntry;
  }
  
  saveLogs(logs) {
    try {
      fs.writeFileSync(this.logsFile, JSON.stringify(logs, null, 2));
      return true;
    } catch (error) {
      return false;
    }
  }
}

// 初始化数据库
const db = new CompleteFileDatabase();

// 初始化Socket.io服务器
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// WebSocket连接处理
io.on('connection', (socket) => {
  console.log('🔌 新的WebSocket连接:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('🔌 WebSocket连接断开:', socket.id);
  });
  
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date().toISOString() });
  });
});

// API接口
app.get('/health', (req, res) => {
  const stats = db.readStats();
  res.status(200).json({ 
    status: 'ok', 
    message: '拾光豆多页面管理系统运行正常',
    mode: 'multi-page-file-database',
    stats: stats,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/status', (req, res) => {
  const stats = db.readStats();
  res.status(200).json({
    service: '拾光豆多页面管理系统',
    version: '2.0.0',
    mode: 'multi-page-file-database',
    status: 'running',
    stats: stats,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/stats', (req, res) => {
  const stats = db.readStats();
  res.status(200).json({
    success: true,
    data: stats,
    mode: 'multi-page-file-database'
  });
});

app.get('/api/messages', (req, res) => {
  const messages = db.readMessages();
  res.status(200).json({
    success: true,
    data: messages,
    total: messages.length
  });
});

app.get('/api/users', (req, res) => {
  const users = db.readUsers();
  res.status(200).json({
    success: true,
    data: users,
    total: users.length
  });
});

app.post('/api/users', (req, res) => {
  const userData = req.body;
  const result = db.addUser(userData);
  
  io.emit('new_user', result);
  
  res.status(200).json({
    success: true,
    data: result,
    message: '用户添加成功'
  });
});

app.post('/api/simulate-message', (req, res) => {
  const message = {
    user_id: 'admin_' + Date.now(),
    content_type: 'text',
    raw_content: '管理员测试消息',
    converted_text: '管理员测试消息'
  };
  
  const result = db.addMessage(message);
  
  io.emit('new_message', result);
  
  res.status(200).json({
    success: true,
    data: result,
    message: '消息发送成功'
  });
});

app.get('/api/logs', (req, res) => {
  const logs = db.readLogs();
  res.status(200).json({
    success: true,
    data: logs.slice(-50), // 返回最近50条日志
    total: logs.length
  });
});

// 静态文件服务
app.use('/static', express.static(path.join(__dirname, '../public')));

// 多页面路由
app.get('/', (req, res) => {
  res.redirect('/overview');
});

app.get('/overview', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/overview.html'));
});

app.get('/management', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/management.html'));
});

app.get('/logs', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/logs.html'));
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('全局错误处理:', err.message);
  res.status(500).json({ 
    error: '服务器内部错误',
    message: err.message
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
const PORT = serverConfig.port || 3000;
const HOST = serverConfig.host || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`📱 拾光豆多页面管理系统启动成功！`);
  console.log(`📡 服务器地址: http://${HOST}:${PORT}`);
  console.log(`🔌 WebSocket地址: ws://${HOST}:${PORT}`);
  console.log(`🏥 健康检查: http://${HOST}:${PORT}/health`);
  console.log(`📊 系统状态: http://${HOST}:${PORT}/api/status`);
  console.log(`🗄️ 多页面文件数据库模式运行中，数据存储在: ${db.dataDir}`);
  console.log(`🎤 语音识别: 微信自带识别（完全免费）`);
  console.log(`💰 费用: 完全免费，无任何收费项目`);
  
  // 添加启动日志
  db.addLog('info', '多页面管理系统启动完成', {
    port: PORT,
    host: HOST,
    mode: 'multi-page-file-database'
  });
});

module.exports = app;
