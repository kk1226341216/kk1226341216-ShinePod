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
        weeklyStats: {
          messages: 0,
          users: 0,
          voiceRecognitions: 0
        }
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
        backupInterval: 24, // hours
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
  
  // 消息管理
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
  
  updateMessage(messageId, updates) {
    const messages = this.readMessages();
    const messageIndex = messages.findIndex(msg => msg._id === messageId);
    
    if (messageIndex !== -1) {
      messages[messageIndex] = { ...messages[messageIndex], ...updates, updated_at: new Date() };
      this.saveMessages(messages);
      this.addLog('info', `消息更新: ${messageId}`);
      return messages[messageIndex];
    }
    return null;
  }
  
  deleteMessage(messageId) {
    const messages = this.readMessages();
    const filteredMessages = messages.filter(msg => msg._id !== messageId);
    
    if (filteredMessages.length < messages.length) {
      this.saveMessages(filteredMessages);
      this.addLog('info', `消息删除: ${messageId}`);
      return true;
    }
    return false;
  }
  
  searchMessages(query) {
    const messages = this.readMessages();
    const { userId, keyword, contentType, startDate, endDate, status, limit = 50 } = query;
    
    let filteredMessages = messages;
    
    if (userId) {
      filteredMessages = filteredMessages.filter(msg => msg.user_id === userId);
    }
    
    if (keyword) {
      filteredMessages = filteredMessages.filter(msg => 
        (msg.converted_text && msg.converted_text.includes(keyword)) ||
        (msg.raw_content && msg.raw_content.includes(keyword))
      );
    }
    
    if (contentType) {
      filteredMessages = filteredMessages.filter(msg => msg.content_type === contentType);
    }
    
    if (status) {
      filteredMessages = filteredMessages.filter(msg => msg.status === status);
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
    
    // 排序
    filteredMessages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // 分页
    return filteredMessages.slice(0, parseInt(limit));
  }
  
  // 用户管理
  readUsers() {
    try {
      const data = fs.readFileSync(this.usersFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }
  
  saveUsers(users) {
    try {
      fs.writeFileSync(this.usersFile, JSON.stringify(users, null, 2));
      return true;
    } catch (error) {
      return false;
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
  
  updateUser(userId, updates) {
    const users = this.readUsers();
    const userIndex = users.findIndex(user => user._id === userId);
    
    if (userIndex !== -1) {
      users[userIndex] = { ...users[userIndex], ...updates, updated_at: new Date() };
      this.saveUsers(users);
      this.addLog('info', `用户更新: ${userId}`);
      return users[userIndex];
    }
    return null;
  }
  
  deleteUser(userId) {
    const users = this.readUsers();
    const filteredUsers = users.filter(user => user._id !== userId);
    
    if (filteredUsers.length < users.length) {
      this.saveUsers(filteredUsers);
      this.addLog('info', `用户删除: ${userId}`);
      return true;
    }
    return false;
  }
  
  getUserStats() {
    const users = this.readUsers();
    const messages = this.readMessages();
    
    const userStats = users.map(user => {
      const userMessages = messages.filter(msg => msg.user_id === user._id);
      return {
        ...user,
        message_count: userMessages.length,
        last_message: userMessages.length > 0 ? userMessages[userMessages.length - 1].created_at : null,
        message_types: {
          text: userMessages.filter(msg => msg.content_type === 'text').length,
          voice: userMessages.filter(msg => msg.content_type === 'voice').length,
          image: userMessages.filter(msg => msg.content_type === 'image').length
        }
      };
    });
    
    return userStats;
  }
  
  // 统计管理
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
      }
    };
  }
  
  resetStats() {
    const resetStats = this.getDefaultStats();
    resetStats.lastResetDate = new Date().toISOString();
    this.saveStats(resetStats);
    this.addLog('warn', '统计数据已重置');
    return resetStats;
  }
  
  // 设置管理
  readSettings() {
    try {
      const data = fs.readFileSync(this.settingsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return this.getDefaultSettings();
    }
  }
  
  saveSettings(settings) {
    try {
      fs.writeFileSync(this.settingsFile, JSON.stringify(settings, null, 2));
      return true;
    } catch (error) {
      return false;
    }
  }
  
  getDefaultSettings() {
    return {
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
  }
  
  updateSettings(updates) {
    const settings = this.readSettings();
    const newSettings = { ...settings, ...updates };
    this.saveSettings(newSettings);
    this.addLog('info', '系统设置已更新');
    return newSettings;
  }
  
  // 日志管理
  readLogs() {
    try {
      const data = fs.readFileSync(this.logsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }
  
  saveLogs(logs) {
    try {
      fs.writeFileSync(this.logsFile, JSON.stringify(logs, null, 2));
      return true;
    } catch (error) {
      return false;
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
    
    // 保持最近1000条日志
    if (logs.length > 1000) {
      logs.splice(0, logs.length - 1000);
    }
    
    this.saveLogs(logs);
    return logEntry;
  }
  
  clearLogs() {
    this.saveLogs([]);
    this.addLog('warn', '系统日志已清空');
    return true;
  }
  
  // 数据备份
  createBackup() {
    const backupData = {
      timestamp: new Date(),
      messages: this.readMessages(),
      users: this.readUsers(),
      stats: this.readStats(),
      settings: this.readSettings(),
      logs: this.readLogs()
    };
    
    const backupFile = path.join(this.dataDir, `backup_${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    
    this.addLog('info', `数据备份已创建: ${backupFile}`);
    return backupFile;
  }
  
  // 数据导出
  exportData(format = 'json', type = 'all') {
    let data = {};
    
    switch (type) {
      case 'messages':
        data = this.readMessages();
        break;
      case 'users':
        data = this.readUsers();
        break;
      case 'stats':
        data = this.readStats();
        break;
      case 'logs':
        data = this.readLogs();
        break;
      case 'all':
      default:
        data = {
          messages: this.readMessages(),
          users: this.readUsers(),
          stats: this.readStats(),
          settings: this.readSettings(),
          logs: this.readLogs()
        };
        break;
    }
    
    this.addLog('info', `数据导出: ${type} - ${format}`);
    return data;
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
  
  socket.on('subscribe', (data) => {
    socket.join(data.room);
    console.log(`用户 ${socket.id} 订阅房间: ${data.room}`);
  });
  
  socket.on('unsubscribe', (data) => {
    socket.leave(data.room);
    console.log(`用户 ${socket.id} 取消订阅房间: ${data.room}`);
  });
});

// API接口
app.get('/health', (req, res) => {
  const stats = db.readStats();
  res.status(200).json({ 
    status: 'ok', 
    message: '拾光豆完整功能管理系统运行正常',
    mode: 'complete-file-database',
    stats: stats,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/status', (req, res) => {
  const stats = db.readStats();
  const settings = db.readSettings();
  
  res.status(200).json({
    service: '拾光豆完整功能管理系统',
    version: settings.version,
    mode: 'complete-file-database',
    status: 'running',
    stats: stats,
    settings: settings,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/stats', (req, res) => {
  const stats = db.readStats();
  res.status(200).json({
    success: true,
    data: stats,
    mode: 'complete-file-database'
  });
});

// 消息管理API
app.get('/api/messages', (req, res) => {
  const { userId, limit = 20, skip = 0, status, contentType } = req.query;
  
  let messages = db.readMessages();
  
  if (userId) {
    messages = messages.filter(msg => msg.user_id === userId);
  }
  
  if (status) {
    messages = messages.filter(msg => msg.status === status);
  }
  
  if (contentType) {
    messages = messages.filter(msg => msg.content_type === contentType);
  }
  
  // 排序
  messages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  // 分页
  const total = messages.length;
  const paginatedMessages = messages.slice(parseInt(skip), parseInt(skip) + parseInt(limit));
  
  res.status(200).json({
    success: true,
    data: paginatedMessages,
    total,
    page: Math.floor(parseInt(skip) / parseInt(limit)) + 1,
    pages: Math.ceil(total / parseInt(limit))
  });
});

app.post('/api/messages', (req, res) => {
  const message = req.body;
  const result = db.addMessage(message);
  
  // 通过WebSocket广播新消息
  io.emit('new_message', result);
  
  res.status(200).json({
    success: true,
    data: result,
    message: '消息添加成功'
  });
});

app.put('/api/messages/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const result = db.updateMessage(id, updates);
  
  if (result) {
    io.emit('message_updated', result);
    res.status(200).json({
      success: true,
      data: result,
      message: '消息更新成功'
    });
  } else {
    res.status(404).json({
      success: false,
      message: '消息不存在'
    });
  }
});

app.delete('/api/messages/:id', (req, res) => {
  const { id } = req.params;
  
  const result = db.deleteMessage(id);
  
  if (result) {
    io.emit('message_deleted', { id });
    res.status(200).json({
      success: true,
      message: '消息删除成功'
    });
  } else {
    res.status(404).json({
      success: false,
      message: '消息不存在'
    });
  }
});

app.post('/api/messages/search', (req, res) => {
  const query = req.body;
  const results = db.searchMessages(query);
  
  res.status(200).json({
    success: true,
    data: results,
    total: results.length
  });
});

// 用户管理API
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

app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const result = db.updateUser(id, updates);
  
  if (result) {
    io.emit('user_updated', result);
    res.status(200).json({
      success: true,
      data: result,
      message: '用户更新成功'
    });
  } else {
    res.status(404).json({
      success: false,
      message: '用户不存在'
    });
  }
});

app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  
  const result = db.deleteUser(id);
  
  if (result) {
    io.emit('user_deleted', { id });
    res.status(200).json({
      success: true,
      message: '用户删除成功'
    });
  } else {
    res.status(404).json({
      success: false,
      message: '用户不存在'
    });
  }
});

app.get('/api/users/stats', (req, res) => {
  const userStats = db.getUserStats();
  res.status(200).json({
    success: true,
    data: userStats
  });
});

// 系统设置API
app.get('/api/settings', (req, res) => {
  const settings = db.readSettings();
  res.status(200).json({
    success: true,
    data: settings
  });
});

app.put('/api/settings', (req, res) => {
  const updates = req.body;
  const result = db.updateSettings(updates);
  
  io.emit('settings_updated', result);
  
  res.status(200).json({
    success: true,
    data: result,
    message: '设置更新成功'
  });
});

// 日志管理API
app.get('/api/logs', (req, res) => {
  const { level, limit = 100 } = req.query;
  
  let logs = db.readLogs();
  
  if (level) {
    logs = logs.filter(log => log.level === level);
  }
  
  // 排序
  logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  // 限制数量
  logs = logs.slice(0, parseInt(limit));
  
  res.status(200).json({
    success: true,
    data: logs,
    total: logs.length
  });
});

app.delete('/api/logs', (req, res) => {
  const result = db.clearLogs();
  
  io.emit('logs_cleared');
  
  res.status(200).json({
    success: true,
    message: '日志清空成功'
  });
});

// 数据管理API
app.post('/api/backup', (req, res) => {
  const backupFile = db.createBackup();
  
  res.status(200).json({
    success: true,
    message: '数据备份成功',
    file: backupFile
  });
});

app.post('/api/export', (req, res) => {
  const { format = 'json', type = 'all' } = req.body;
  const data = db.exportData(format, type);
  
  res.status(200).json({
    success: true,
    data: data,
    format: format,
    type: type
  });
});

app.post('/api/reset-stats', (req, res) => {
  const result = db.resetStats();
  
  io.emit('stats_reset', result);
  
  res.status(200).json({
    success: true,
    data: result,
    message: '统计数据重置成功'
  });
});

// 模拟消息API
app.post('/api/simulate-message', (req, res) => {
  const message = {
    user_id: 'admin_' + Date.now(),
    content_type: 'text',
    raw_content: '管理员测试消息',
    converted_text: '管理员测试消息'
  };
  
  const result = db.addMessage(message);
  
  // 通过WebSocket广播新消息
  io.emit('new_message', result);
  
  res.status(200).json({
    success: true,
    data: result,
    message: '消息发送成功'
  });
});

// 🎨 完整功能前端界面
app.get('/', (req, res) => {
  const stats = db.readStats();
  const settings = db.readSettings();
  
  res.send(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>拾光豆 完整功能管理系统</title>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            :root {
                --primary-color: #6366f1;
                --primary-dark: #4f46e5;
                --secondary-color: #8b5cf6;
                --success-color: #10b981;
                --warning-color: #f59e0b;
                --danger-color: #ef4444;
                --info-color: #06b6d4;
                --dark-color: #1f2937;
                --light-color: #f8fafc;
                --border-color: #e2e8f0;
                --text-primary: #1e293b;
                --text-secondary: #64748b;
                --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
                --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
                --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);
            }
            
            body { 
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: var(--text-primary);
                min-height: 100vh;
            }
            
            .app-container {
                min-height: 100vh;
                display: flex;
                flex-direction: column;
            }
            
            .header {
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                border-bottom: 1px solid var(--border-color);
                padding: 1rem 2rem;
                box-shadow: var(--shadow-sm);
            }
            
            .header-content {
                max-width: 1200px;
                margin: 0 auto;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .logo {
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }
            
            .logo-icon {
                width: 40px;
                height: 40px;
                background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 1.25rem;
            }
            
            .logo-text {
                font-size: 1.5rem;
                font-weight: 700;
                color: var(--text-primary);
            }
            
            .status-indicator {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.5rem 1rem;
                background: var(--success-color);
                color: white;
                border-radius: 20px;
                font-size: 0.875rem;
                font-weight: 500;
            }
            
            .status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: white;
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            .main-content {
                flex: 1;
                padding: 2rem;
                max-width: 1200px;
                margin: 0 auto;
                width: 100%;
            }
            
            .dashboard-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 1.5rem;
                margin-bottom: 2rem;
            }
            
            .card {
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                border-radius: 16px;
                padding: 1.5rem;
                box-shadow: var(--shadow-lg);
                border: 1px solid rgba(255, 255, 255, 0.2);
                transition: all 0.3s ease;
            }
            
            .card:hover {
                transform: translateY(-2px);
                box-shadow: var(--shadow-xl);
            }
            
            .card-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1rem;
            }
            
            .card-title {
                font-size: 1.125rem;
                font-weight: 600;
                color: var(--text-primary);
            }
            
            .card-icon {
                width: 40px;
                height: 40px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.25rem;
                color: white;
            }
            
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 1rem;
            }
            
            .stat-item {
                text-align: center;
                padding: 1rem;
                background: var(--light-color);
                border-radius: 12px;
                border: 1px solid var(--border-color);
            }
            
            .stat-value {
                font-size: 2rem;
                font-weight: 700;
                color: var(--primary-color);
                margin-bottom: 0.25rem;
            }
            
            .stat-label {
                font-size: 0.875rem;
                color: var(--text-secondary);
                font-weight: 500;
            }
            
            .actions-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
            }
            
            .btn {
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: 12px;
                font-size: 0.875rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                text-decoration: none;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                text-align: center;
            }
            
            .btn-primary {
                background: var(--primary-color);
                color: white;
            }
            
            .btn-primary:hover {
                background: var(--primary-dark);
                transform: translateY(-1px);
            }
            
            .btn-success {
                background: var(--success-color);
                color: white;
            }
            
            .btn-success:hover {
                background: #059669;
                transform: translateY(-1px);
            }
            
            .btn-warning {
                background: var(--warning-color);
                color: white;
            }
            
            .btn-warning:hover {
                background: #d97706;
                transform: translateY(-1px);
            }
            
            .btn-danger {
                background: var(--danger-color);
                color: white;
            }
            
            .btn-danger:hover {
                background: #dc2626;
                transform: translateY(-1px);
            }
            
            .btn-info {
                background: var(--info-color);
                color: white;
            }
            
            .btn-info:hover {
                background: #0891b2;
                transform: translateY(-1px);
            }
            
            .result-container {
                margin-top: 2rem;
                padding: 1.5rem;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                border-radius: 16px;
                box-shadow: var(--shadow-lg);
                border: 1px solid rgba(255, 255, 255, 0.2);
                max-height: 400px;
                overflow-y: auto;
            }
            
            .result-item {
                margin: 0.5rem 0;
                padding: 0.75rem;
                border-radius: 8px;
                font-size: 0.875rem;
                line-height: 1.5;
            }
            
            .result-success {
                background: #d4edda;
                color: #155724;
                border-left: 4px solid var(--success-color);
            }
            
            .result-error {
                background: #f8d7da;
                color: #721c24;
                border-left: 4px solid var(--danger-color);
            }
            
            .result-info {
                background: #d1ecf1;
                color: #0c5460;
                border-left: 4px solid var(--info-color);
            }
            
            .result-warning {
                background: #fff3cd;
                color: #856404;
                border-left: 4px solid var(--warning-color);
            }
            
            .floating-refresh {
                position: fixed;
                bottom: 2rem;
                right: 2rem;
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: var(--primary-color);
                color: white;
                border: none;
                font-size: 1.5rem;
                cursor: pointer;
                box-shadow: var(--shadow-xl);
                transition: all 0.3s ease;
                z-index: 1000;
            }
            
            .floating-refresh:hover {
                transform: scale(1.1);
                box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
            }
            
            .loading {
                display: inline-block;
                width: 20px;
                height: 20px;
                border: 3px solid rgba(255,255,255,.3);
                border-radius: 50%;
                border-top-color: #fff;
                animation: spin 1s ease-in-out infinite;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            @media (max-width: 768px) {
                .main-content {
                    padding: 1rem;
                }
                
                .dashboard-grid {
                    grid-template-columns: 1fr;
                }
                
                .header-content {
                    flex-direction: column;
                    gap: 1rem;
                }
                
                .actions-grid {
                    grid-template-columns: 1fr;
                }
            }
        </style>
    </head>
    <body>
        <div class="app-container">
            <header class="header">
                <div class="header-content">
                    <div class="logo">
                        <div class="logo-icon">
                            <i class="fas fa-cube"></i>
                        </div>
                        <div class="logo-text">拾光豆完整功能管理系统</div>
                    </div>
                    <div class="status-indicator">
                        <div class="status-dot"></div>
                        <span>系统运行正常 - 功能完整</span>
                    </div>
                </div>
            </header>

            <main class="main-content">
                <div class="dashboard-grid">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">系统统计</h3>
                            <div class="card-icon" style="background: var(--primary-color);">
                                <i class="fas fa-chart-bar"></i>
                            </div>
                        </div>
                        <div class="stats-grid">
                            <div class="stat-item">
                                <div class="stat-value">${stats.totalMessages}</div>
                                <div class="stat-label">总消息数</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-value">${stats.totalUsers}</div>
                                <div class="stat-label">总用户数</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-value">${stats.voiceMessages}</div>
                                <div class="stat-label">语音消息</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-value">${stats.freeVoiceRecognitions}</div>
                                <div class="stat-label">语音识别</div>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">消息管理</h3>
                            <div class="card-icon" style="background: var(--success-color);">
                                <i class="fas fa-comments"></i>
                            </div>
                        </div>
                        <div class="actions-grid">
                            <button class="btn btn-primary" onclick="loadMessages()">
                                <i class="fas fa-download"></i> 加载消息
                            </button>
                            <button class="btn btn-success" onclick="searchMessages()">
                                <i class="fas fa-search"></i> 搜索消息
                            </button>
                            <button class="btn btn-warning" onclick="simulateMessage()">
                                <i class="fas fa-paper-plane"></i> 模拟消息
                            </button>
                            <button class="btn btn-info" onclick="exportData('messages')">
                                <i class="fas fa-file-export"></i> 导出消息
                            </button>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">用户管理</h3>
                            <div class="card-icon" style="background: var(--warning-color);">
                                <i class="fas fa-users"></i>
                            </div>
                        </div>
                        <div class="actions-grid">
                            <button class="btn btn-primary" onclick="loadUsers()">
                                <i class="fas fa-download"></i> 加载用户
                            </button>
                            <button class="btn btn-success" onclick="addUser()">
                                <i class="fas fa-user-plus"></i> 添加用户
                            </button>
                            <button class="btn btn-warning" onclick="loadUserStats()">
                                <i class="fas fa-chart-line"></i> 用户统计
                            </button>
                            <button class="btn btn-info" onclick="exportData('users')">
                                <i class="fas fa-file-export"></i> 导出用户
                            </button>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">系统管理</h3>
                            <div class="card-icon" style="background: var(--info-color);">
                                <i class="fas fa-cog"></i>
                            </div>
                        </div>
                        <div class="actions-grid">
                            <button class="btn btn-primary" onclick="testHealth()">
                                <i class="fas fa-heartbeat"></i> 健康检查
                            </button>
                            <button class="btn btn-success" onclick="testWebSocket()">
                                <i class="fas fa-wifi"></i> WebSocket测试
                            </button>
                            <button class="btn btn-warning" onclick="loadLogs()">
                                <i class="fas fa-file-alt"></i> 系统日志
                            </button>
                            <button class="btn btn-danger" onclick="resetStats()">
                                <i class="fas fa-redo"></i> 重置统计
                            </button>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">数据管理</h3>
                            <div class="card-icon" style="background: var(--secondary-color);">
                                <i class="fas fa-database"></i>
                            </div>
                        </div>
                        <div class="actions-grid">
                            <button class="btn btn-primary" onclick="createBackup()">
                                <i class="fas fa-save"></i> 创建备份
                            </button>
                            <button class="btn btn-success" onclick="exportData('all')">
                                <i class="fas fa-download"></i> 导出全部
                            </button>
                            <button class="btn btn-warning" onclick="loadSettings()">
                                <i class="fas fa-cog"></i> 系统设置
                            </button>
                            <button class="btn btn-info" onclick="refreshStats()">
                                <i class="fas fa-sync-alt"></i> 刷新统计
                            </button>
                        </div>
                    </div>
                </div>

                <div class="result-container">
                    <h3 style="margin-bottom: 1rem; color: var(--text-primary);">
                        <i class="fas fa-terminal"></i> 操作结果
                    </h3>
                    <div id="result">
                        <div class="result-item result-info">
                            <i class="fas fa-info-circle"></i> 系统加载完成，所有功能已就绪
                        </div>
                    </div>
                </div>
            </main>
        </div>

        <button class="floating-refresh" onclick="refreshAll()" title="刷新所有数据">
            <i class="fas fa-sync-alt"></i>
        </button>

        <script>
            let ws = null;
            
            function showResult(message, type = 'info') {
                const result = document.getElementById('result');
                const timestamp = new Date().toLocaleTimeString();
                const icon = type === 'success' ? 'check-circle' : 
                           type === 'error' ? 'exclamation-circle' : 
                           type === 'warning' ? 'exclamation-triangle' : 'info-circle';
                
                const resultItem = document.createElement('div');
                resultItem.className = 'result-item result-' + type;
                resultItem.innerHTML = '<i class="fas fa-' + icon + '"></i> [' + timestamp + '] ' + message;
                
                result.appendChild(resultItem);
                result.scrollTop = result.scrollHeight;
            }
            
            function testHealth() {
                showResult('正在检查系统健康状态...', 'info');
                fetch('/health')
                    .then(response => response.json())
                    .then(data => {
                        showResult('健康检查成功: ' + data.message, 'success');
                        showResult('系统模式: ' + data.mode, 'info');
                    })
                    .catch(error => {
                        showResult('健康检查失败: ' + error.message, 'error');
                    });
            }
            
            function testWebSocket() {
                showResult('正在测试WebSocket连接...', 'info');
                
                if (ws) ws.close();
                
                ws = new WebSocket('ws://localhost:3000');
                
                ws.onopen = () => {
                    showResult('WebSocket连接成功！', 'success');
                };
                
                ws.onmessage = (event) => {
                    showResult('收到消息: ' + event.data, 'info');
                };
                
                ws.onerror = (error) => {
                    showResult('WebSocket连接失败', 'error');
                };
                
                ws.onclose = () => {
                    showResult('WebSocket连接关闭', 'info');
                };
            }
            
            function simulateMessage() {
                showResult('正在发送模拟消息...', 'info');
                
                fetch('/api/simulate-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showResult('消息发送成功: ' + data.data.user_id, 'success');
                        } else {
                            showResult('消息发送失败', 'error');
                        }
                    })
                    .catch(error => {
                        showResult('消息发送失败: ' + error.message, 'error');
                    });
            }
            
            function loadMessages() {
                showResult('正在加载消息列表...', 'info');
                
                fetch('/api/messages')
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showResult('消息加载成功，共 ' + data.total + ' 条消息', 'success');
                            if (data.data.length > 0) {
                                showResult('最新消息: ' + data.data[0].user_id + ' - ' + data.data[0].content_type, 'info');
                            }
                        } else {
                            showResult('消息加载失败', 'error');
                        }
                    })
                    .catch(error => {
                        showResult('消息加载失败: ' + error.message, 'error');
                    });
            }
            
            function searchMessages() {
                const keyword = prompt('请输入搜索关键词:');
                if (keyword) {
                    showResult('正在搜索消息: ' + keyword, 'info');
                    
                    fetch('/api/messages/search', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ keyword: keyword, limit: 10 })
                    })
                        .then(response => response.json())
                        .then(data => {
                            if (data.success) {
                                showResult('搜索完成，找到 ' + data.total + ' 条消息', 'success');
                                if (data.data.length > 0) {
                                    showResult('搜索结果: ' + data.data[0].user_id + ' - ' + data.data[0].converted_text, 'info');
                                }
                            } else {
                                showResult('搜索失败', 'error');
                            }
                        })
                        .catch(error => {
                            showResult('搜索失败: ' + error.message, 'error');
                        });
                }
            }
            
            function loadUsers() {
                showResult('正在加载用户列表...', 'info');
                
                fetch('/api/users')
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showResult('用户加载成功，共 ' + data.total + ' 个用户', 'success');
                            if (data.data.length > 0) {
                                showResult('最新用户: ' + (data.data[0].username || data.data[0].user_id), 'info');
                            }
                        } else {
                            showResult('用户加载失败', 'error');
                        }
                    })
                    .catch(error => {
                        showResult('用户加载失败: ' + error.message, 'error');
                    });
            }
            
            function addUser() {
                const username = prompt('请输入用户名:');
                if (username) {
                    showResult('正在添加用户: ' + username, 'info');
                    
                    fetch('/api/users', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            username: username, 
                            email: username + '@example.com',
                            user_id: 'user_' + Date.now()
                        })
                    })
                        .then(response => response.json())
                        .then(data => {
                            if (data.success) {
                                showResult('用户添加成功: ' + data.data.username, 'success');
                            } else {
                                showResult('用户添加失败', 'error');
                            }
                        })
                        .catch(error => {
                            showResult('用户添加失败: ' + error.message, 'error');
                        });
                }
            }
            
            function loadUserStats() {
                showResult('正在加载用户统计...', 'info');
                
                fetch('/api/users/stats')
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showResult('用户统计加载成功，共 ' + data.data.length + ' 个用户', 'success');
                            if (data.data.length > 0) {
                                const user = data.data[0];
                                showResult('用户详情: ' + user.username + ' - 消息数: ' + user.message_count, 'info');
                            }
                        } else {
                            showResult('用户统计加载失败', 'error');
                        }
                    })
                    .catch(error => {
                        showResult('用户统计加载失败: ' + error.message, 'error');
                    });
            }
            
            function loadLogs() {
                showResult('正在加载系统日志...', 'info');
                
                fetch('/api/logs')
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showResult('日志加载成功，共 ' + data.total + ' 条日志', 'success');
                            if (data.data.length > 0) {
                                showResult('最新日志: ' + data.data[0].level + ' - ' + data.data[0].message, 'info');
                            }
                        } else {
                            showResult('日志加载失败', 'error');
                        }
                    })
                    .catch(error => {
                        showResult('日志加载失败: ' + error.message, 'error');
                    });
            }
            
            function exportData(type) {
                showResult('正在导出数据: ' + type, 'info');
                
                fetch('/api/export', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ format: 'json', type: type })
                })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showResult('数据导出成功: ' + type, 'success');
                            showResult('导出数据大小: ' + JSON.stringify(data.data).length + ' 字符', 'info');
                        } else {
                            showResult('数据导出失败', 'error');
                        }
                    })
                    .catch(error => {
                        showResult('数据导出失败: ' + error.message, 'error');
                    });
            }
            
            function createBackup() {
                showResult('正在创建数据备份...', 'info');
                
                fetch('/api/backup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showResult('数据备份成功', 'success');
                            showResult('备份文件: ' + data.file, 'info');
                        } else {
                            showResult('数据备份失败', 'error');
                        }
                    })
                    .catch(error => {
                        showResult('数据备份失败: ' + error.message, 'error');
                    });
            }
            
            function loadSettings() {
                showResult('正在加载系统设置...', 'info');
                
                fetch('/api/settings')
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showResult('系统设置加载成功', 'success');
                            showResult('系统名称: ' + data.data.systemName + ' - 版本: ' + data.data.version, 'info');
                        } else {
                            showResult('系统设置加载失败', 'error');
                        }
                    })
                    .catch(error => {
                        showResult('系统设置加载失败: ' + error.message, 'error');
                    });
            }
            
            function resetStats() {
                if (confirm('确定要重置统计数据吗？此操作不可恢复！')) {
                    showResult('正在重置统计数据...', 'info');
                    
                    fetch('/api/reset-stats', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    })
                        .then(response => response.json())
                        .then(data => {
                            if (data.success) {
                                showResult('统计数据重置成功', 'success');
                                setTimeout(() => location.reload(), 2000);
                            } else {
                                showResult('统计数据重置失败', 'error');
                            }
                        })
                        .catch(error => {
                            showResult('统计数据重置失败: ' + error.message, 'error');
                        });
                }
            }
            
            function refreshStats() {
                showResult('正在刷新统计数据...', 'info');
                setTimeout(() => location.reload(), 1000);
            }
            
            function refreshAll() {
                showResult('正在刷新所有数据...', 'info');
                setTimeout(() => location.reload(), 1000);
            }
            
            // 页面加载完成后自动测试
            window.onload = function() {
                showResult('系统加载完成，开始自动测试...', 'success');
                setTimeout(() => testHealth(), 1000);
                setTimeout(() => testWebSocket(), 2000);
                setTimeout(() => loadMessages(), 3000);
                setTimeout(() => loadUsers(), 4000);
            };
        </script>
    </body>
    </html>
  `);
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('全局错误处理:', err.message);
  db.addLog('error', 'API错误', err.message);
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
  console.log(`🚀 拾光豆完整功能管理系统启动成功！`);
  console.log(`📡 服务器地址: http://${HOST}:${PORT}`);
  console.log(`🔌 WebSocket地址: ws://${HOST}:${PORT}`);
  console.log(`🏥 健康检查: http://${HOST}:${PORT}/health`);
  console.log(`📊 系统状态: http://${HOST}:${PORT}/api/status`);
  console.log(`🗄️ 完整功能数据库模式运行中，数据存储在: ${db.dataDir}`);
  console.log(`🎤 语音识别: 微信自带识别（完全免费）`);
  console.log(`💰 费用: 完全免费，无任何收费项目`);
  
  // 添加启动日志
  db.addLog('info', '系统启动完成', {
    port: PORT,
    host: HOST,
    mode: 'complete-file-database'
  });
});

module.exports = app;
