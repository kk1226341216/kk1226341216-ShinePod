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
      }
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
    message: '拾光豆现代化管理系统运行正常',
    mode: 'modern-file-database',
    stats: stats,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/status', (req, res) => {
  const stats = db.readStats();
  res.status(200).json({
    service: '拾光豆现代化管理系统',
    version: '2.0.0',
    mode: 'modern-file-database',
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
    mode: 'modern-file-database'
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

// 🎨 现代化B端界面 - 参考最新设计趋势
app.get('/', (req, res) => {
  const stats = db.readStats();
  
  res.send(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>拾光豆管理系统</title>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            :root {
                --primary: #3b82f6;
                --primary-dark: #2563eb;
                --primary-light: #dbeafe;
                --secondary: #64748b;
                --success: #10b981;
                --warning: #f59e0b;
                --danger: #ef4444;
                --info: #06b6d4;
                --gray-50: #f8fafc;
                --gray-100: #f1f5f9;
                --gray-200: #e2e8f0;
                --gray-300: #cbd5e1;
                --gray-400: #94a3b8;
                --gray-500: #64748b;
                --gray-600: #475569;
                --gray-700: #334155;
                --gray-800: #1e293b;
                --gray-900: #0f172a;
                --white: #ffffff;
                --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
                --shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
                --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
                --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
                --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
                --radius: 0.5rem;
                --radius-lg: 0.75rem;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                background: var(--gray-50);
                color: var(--gray-900);
                line-height: 1.6;
            }
            
            .app {
                min-height: 100vh;
                display: flex;
                flex-direction: column;
            }
            
            /* 顶部导航栏 */
            .header {
                background: var(--white);
                border-bottom: 1px solid var(--gray-200);
                box-shadow: var(--shadow-sm);
                position: sticky;
                top: 0;
                z-index: 50;
            }
            
            .header-content {
                max-width: 1280px;
                margin: 0 auto;
                padding: 0 1.5rem;
                display: flex;
                align-items: center;
                justify-content: space-between;
                height: 4rem;
            }
            
            .logo {
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }
            
            .logo-icon {
                width: 2.5rem;
                height: 2.5rem;
                background: linear-gradient(135deg, var(--primary), var(--primary-dark));
                border-radius: var(--radius);
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--white);
                font-size: 1.25rem;
            }
            
            .logo-text {
                font-size: 1.25rem;
                font-weight: 700;
                color: var(--gray-900);
            }
            
            .header-actions {
                display: flex;
                align-items: center;
                gap: 1rem;
            }
            
            .status-badge {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.5rem 1rem;
                background: var(--success);
                color: var(--white);
                border-radius: 9999px;
                font-size: 0.875rem;
                font-weight: 500;
            }
            
            .status-dot {
                width: 0.5rem;
                height: 0.5rem;
                background: var(--white);
                border-radius: 50%;
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            /* 主内容区域 */
            .main {
                flex: 1;
                max-width: 1280px;
                margin: 0 auto;
                padding: 2rem 1.5rem;
                width: 100%;
            }
            
            /* 页面标题 */
            .page-header {
                margin-bottom: 2rem;
            }
            
            .page-title {
                font-size: 2rem;
                font-weight: 800;
                color: var(--gray-900);
                margin-bottom: 0.5rem;
            }
            
            .page-description {
                color: var(--gray-600);
                font-size: 1.125rem;
            }
            
            /* 统计卡片网格 */
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 1.5rem;
                margin-bottom: 3rem;
            }
            
            .stat-card {
                background: var(--white);
                border-radius: var(--radius-lg);
                padding: 1.5rem;
                box-shadow: var(--shadow);
                border: 1px solid var(--gray-200);
                transition: all 0.2s ease;
            }
            
            .stat-card:hover {
                box-shadow: var(--shadow-lg);
                transform: translateY(-1px);
            }
            
            .stat-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 1rem;
            }
            
            .stat-title {
                font-size: 0.875rem;
                font-weight: 600;
                color: var(--gray-600);
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            
            .stat-icon {
                width: 2.5rem;
                height: 2.5rem;
                border-radius: var(--radius);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.25rem;
                color: var(--white);
            }
            
            .stat-value {
                font-size: 2.5rem;
                font-weight: 800;
                color: var(--gray-900);
                margin-bottom: 0.25rem;
            }
            
            .stat-change {
                font-size: 0.875rem;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 0.25rem;
            }
            
            .stat-change.positive {
                color: var(--success);
            }
            
            .stat-change.negative {
                color: var(--danger);
            }
            
            /* 功能区域 */
            .features-section {
                margin-bottom: 3rem;
            }
            
            .section-title {
                font-size: 1.5rem;
                font-weight: 700;
                color: var(--gray-900);
                margin-bottom: 1.5rem;
            }
            
            .features-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 1.5rem;
            }
            
            .feature-card {
                background: var(--white);
                border-radius: var(--radius-lg);
                padding: 1.5rem;
                box-shadow: var(--shadow);
                border: 1px solid var(--gray-200);
                transition: all 0.2s ease;
            }
            
            .feature-card:hover {
                box-shadow: var(--shadow-lg);
                transform: translateY(-2px);
            }
            
            .feature-header {
                display: flex;
                align-items: center;
                gap: 1rem;
                margin-bottom: 1rem;
            }
            
            .feature-icon {
                width: 3rem;
                height: 3rem;
                border-radius: var(--radius);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.5rem;
                color: var(--white);
            }
            
            .feature-title {
                font-size: 1.125rem;
                font-weight: 600;
                color: var(--gray-900);
            }
            
            .feature-description {
                color: var(--gray-600);
                margin-bottom: 1.5rem;
                line-height: 1.6;
            }
            
            .feature-actions {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: 0.75rem;
            }
            
            /* 按钮样式 */
            .btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                padding: 0.75rem 1rem;
                border-radius: var(--radius);
                font-size: 0.875rem;
                font-weight: 500;
                text-decoration: none;
                border: none;
                cursor: pointer;
                transition: all 0.2s ease;
                white-space: nowrap;
            }
            
            .btn-primary {
                background: var(--primary);
                color: var(--white);
            }
            
            .btn-primary:hover {
                background: var(--primary-dark);
                transform: translateY(-1px);
            }
            
            .btn-success {
                background: var(--success);
                color: var(--white);
            }
            
            .btn-success:hover {
                background: #059669;
                transform: translateY(-1px);
            }
            
            .btn-warning {
                background: var(--warning);
                color: var(--white);
            }
            
            .btn-warning:hover {
                background: #d97706;
                transform: translateY(-1px);
            }
            
            .btn-danger {
                background: var(--danger);
                color: var(--white);
            }
            
            .btn-danger:hover {
                background: #dc2626;
                transform: translateY(-1px);
            }
            
            .btn-secondary {
                background: var(--gray-100);
                color: var(--gray-700);
                border: 1px solid var(--gray-300);
            }
            
            .btn-secondary:hover {
                background: var(--gray-200);
                transform: translateY(-1px);
            }
            
            /* 操作结果区域 */
            .results-section {
                background: var(--white);
                border-radius: var(--radius-lg);
                box-shadow: var(--shadow);
                border: 1px solid var(--gray-200);
                overflow: hidden;
            }
            
            .results-header {
                padding: 1.5rem;
                border-bottom: 1px solid var(--gray-200);
                background: var(--gray-50);
            }
            
            .results-title {
                font-size: 1.125rem;
                font-weight: 600;
                color: var(--gray-900);
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .results-content {
                padding: 1.5rem;
                max-height: 400px;
                overflow-y: auto;
            }
            
            .result-item {
                padding: 0.75rem;
                margin-bottom: 0.5rem;
                border-radius: var(--radius);
                font-size: 0.875rem;
                line-height: 1.5;
                display: flex;
                align-items: flex-start;
                gap: 0.75rem;
            }
            
            .result-item:last-child {
                margin-bottom: 0;
            }
            
            .result-icon {
                width: 1.25rem;
                height: 1.25rem;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.75rem;
                flex-shrink: 0;
                margin-top: 0.125rem;
            }
            
            .result-success {
                background: #dcfce7;
                color: #166534;
                border-left: 3px solid var(--success);
            }
            
            .result-success .result-icon {
                background: var(--success);
                color: var(--white);
            }
            
            .result-error {
                background: #fef2f2;
                color: #991b1b;
                border-left: 3px solid var(--danger);
            }
            
            .result-error .result-icon {
                background: var(--danger);
                color: var(--white);
            }
            
            .result-info {
                background: #eff6ff;
                color: #1e40af;
                border-left: 3px solid var(--info);
            }
            
            .result-info .result-icon {
                background: var(--info);
                color: var(--white);
            }
            
            .result-warning {
                background: #fffbeb;
                color: #92400e;
                border-left: 3px solid var(--warning);
            }
            
            .result-warning .result-icon {
                background: var(--warning);
                color: var(--white);
            }
            
            /* 浮动操作按钮 */
            .floating-actions {
                position: fixed;
                bottom: 2rem;
                right: 2rem;
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
                z-index: 50;
            }
            
            .floating-btn {
                width: 3rem;
                height: 3rem;
                border-radius: 50%;
                background: var(--primary);
                color: var(--white);
                border: none;
                font-size: 1.25rem;
                cursor: pointer;
                box-shadow: var(--shadow-lg);
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .floating-btn:hover {
                transform: scale(1.1);
                box-shadow: var(--shadow-xl);
            }
            
            .floating-btn.secondary {
                background: var(--gray-600);
            }
            
            /* 响应式设计 */
            @media (max-width: 768px) {
                .main {
                    padding: 1rem;
                }
                
                .header-content {
                    padding: 0 1rem;
                }
                
                .stats-grid {
                    grid-template-columns: 1fr;
                }
                
                .features-grid {
                    grid-template-columns: 1fr;
                }
                
                .feature-actions {
                    grid-template-columns: 1fr;
                }
                
                .page-title {
                    font-size: 1.5rem;
                }
                
                .floating-actions {
                    bottom: 1rem;
                    right: 1rem;
                }
            }
            
            /* 加载动画 */
            .loading {
                display: inline-block;
                width: 1rem;
                height: 1rem;
                border: 2px solid var(--gray-300);
                border-radius: 50%;
                border-top-color: var(--primary);
                animation: spin 1s ease-in-out infinite;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        </style>
    </head>
    <body>
        <div class="app">
            <!-- 顶部导航栏 -->
            <header class="header">
                <div class="header-content">
                    <div class="logo">
                        <div class="logo-icon">
                            <i class="fas fa-cube"></i>
                        </div>
                        <div class="logo-text">拾光豆管理系统</div>
                    </div>
                    <div class="header-actions">
                        <div class="status-badge">
                            <div class="status-dot"></div>
                            <span>系统运行正常</span>
                        </div>
                    </div>
                </div>
            </header>

            <!-- 主内容区域 -->
            <main class="main">
                <!-- 页面标题 -->
                <div class="page-header">
                    <h1 class="page-title">系统概览</h1>
                    <p class="page-description">现代化的数据管理和监控平台</p>
                </div>

                <!-- 统计卡片 -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-header">
                            <div class="stat-title">总消息数</div>
                            <div class="stat-icon" style="background: var(--primary);">
                                <i class="fas fa-comments"></i>
                            </div>
                        </div>
                        <div class="stat-value">${stats.totalMessages}</div>
                        <div class="stat-change positive">
                            <i class="fas fa-arrow-up"></i>
                            <span>+${stats.dailyUsage.messages} 今日</span>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-header">
                            <div class="stat-title">总用户数</div>
                            <div class="stat-icon" style="background: var(--success);">
                                <i class="fas fa-users"></i>
                            </div>
                        </div>
                        <div class="stat-value">${stats.totalUsers}</div>
                        <div class="stat-change positive">
                            <i class="fas fa-arrow-up"></i>
                            <span>+${stats.dailyUsage.newUsers} 今日</span>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-header">
                            <div class="stat-title">语音消息</div>
                            <div class="stat-icon" style="background: var(--warning);">
                                <i class="fas fa-microphone"></i>
                            </div>
                        </div>
                        <div class="stat-value">${stats.voiceMessages}</div>
                        <div class="stat-change positive">
                            <i class="fas fa-arrow-up"></i>
                            <span>${stats.freeVoiceRecognitions} 已识别</span>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-header">
                            <div class="stat-title">文本消息</div>
                            <div class="stat-icon" style="background: var(--info);">
                                <i class="fas fa-file-text"></i>
                            </div>
                        </div>
                        <div class="stat-value">${stats.textMessages}</div>
                        <div class="stat-change positive">
                            <i class="fas fa-arrow-up"></i>
                            <span>活跃</span>
                        </div>
                    </div>
                </div>

                <!-- 功能区域 -->
                <div class="features-section">
                    <h2 class="section-title">功能管理</h2>
                    <div class="features-grid">
                        <!-- 消息管理 -->
                        <div class="feature-card">
                            <div class="feature-header">
                                <div class="feature-icon" style="background: var(--primary);">
                                    <i class="fas fa-comments"></i>
                                </div>
                                <div class="feature-title">消息管理</div>
                            </div>
                            <div class="feature-description">
                                管理用户消息，支持搜索、过滤和导出功能
                            </div>
                            <div class="feature-actions">
                                <button class="btn btn-primary" onclick="loadMessages()">
                                    <i class="fas fa-download"></i> 加载消息
                                </button>
                                <button class="btn btn-success" onclick="searchMessages()">
                                    <i class="fas fa-search"></i> 搜索
                                </button>
                                <button class="btn btn-warning" onclick="simulateMessage()">
                                    <i class="fas fa-paper-plane"></i> 模拟
                                </button>
                            </div>
                        </div>

                        <!-- 用户管理 -->
                        <div class="feature-card">
                            <div class="feature-header">
                                <div class="feature-icon" style="background: var(--success);">
                                    <i class="fas fa-users"></i>
                                </div>
                                <div class="feature-title">用户管理</div>
                            </div>
                            <div class="feature-description">
                                管理用户信息，查看用户统计和活跃度
                            </div>
                            <div class="feature-actions">
                                <button class="btn btn-primary" onclick="loadUsers()">
                                    <i class="fas fa-download"></i> 加载用户
                                </button>
                                <button class="btn btn-success" onclick="addUser()">
                                    <i class="fas fa-user-plus"></i> 添加用户
                                </button>
                                <button class="btn btn-secondary" onclick="loadUserStats()">
                                    <i class="fas fa-chart-line"></i> 统计
                                </button>
                            </div>
                        </div>

                        <!-- 系统监控 -->
                        <div class="feature-card">
                            <div class="feature-header">
                                <div class="feature-icon" style="background: var(--warning);">
                                    <i class="fas fa-chart-line"></i>
                                </div>
                                <div class="feature-title">系统监控</div>
                            </div>
                            <div class="feature-description">
                                监控系统状态，查看日志和性能指标
                            </div>
                            <div class="feature-actions">
                                <button class="btn btn-primary" onclick="testHealth()">
                                    <i class="fas fa-heartbeat"></i> 健康检查
                                </button>
                                <button class="btn btn-success" onclick="testWebSocket()">
                                    <i class="fas fa-wifi"></i> 连接测试
                                </button>
                                <button class="btn btn-secondary" onclick="loadLogs()">
                                    <i class="fas fa-file-alt"></i> 日志
                                </button>
                            </div>
                        </div>

                        <!-- 数据管理 -->
                        <div class="feature-card">
                            <div class="feature-header">
                                <div class="feature-icon" style="background: var(--info);">
                                    <i class="fas fa-database"></i>
                                </div>
                                <div class="feature-title">数据管理</div>
                            </div>
                            <div class="feature-description">
                                数据备份、导出和系统设置管理
                            </div>
                            <div class="feature-actions">
                                <button class="btn btn-primary" onclick="createBackup()">
                                    <i class="fas fa-save"></i> 备份
                                </button>
                                <button class="btn btn-success" onclick="exportData()">
                                    <i class="fas fa-download"></i> 导出
                                </button>
                                <button class="btn btn-danger" onclick="resetStats()">
                                    <i class="fas fa-redo"></i> 重置
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 操作结果 -->
                <div class="results-section">
                    <div class="results-header">
                        <div class="results-title">
                            <i class="fas fa-terminal"></i>
                            操作日志
                        </div>
                    </div>
                    <div class="results-content">
                        <div id="results">
                            <div class="result-item result-info">
                                <div class="result-icon">
                                    <i class="fas fa-info-circle"></i>
                                </div>
                                <div>系统加载完成，所有功能已就绪</div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>

        <!-- 浮动操作按钮 -->
        <div class="floating-actions">
            <button class="floating-btn secondary" onclick="refreshStats()" title="刷新统计">
                <i class="fas fa-sync-alt"></i>
            </button>
            <button class="floating-btn" onclick="refreshAll()" title="刷新全部">
                <i class="fas fa-redo"></i>
            </button>
        </div>

        <script>
            let ws = null;
            
            function showResult(message, type = 'info') {
                const results = document.getElementById('results');
                const timestamp = new Date().toLocaleTimeString();
                const iconMap = {
                    success: 'check-circle',
                    error: 'exclamation-circle',
                    warning: 'exclamation-triangle',
                    info: 'info-circle'
                };
                
                const resultItem = document.createElement('div');
                resultItem.className = 'result-item result-' + type;
                resultItem.innerHTML = \`
                    <div class="result-icon">
                        <i class="fas fa-\${iconMap[type]}"></i>
                    </div>
                    <div>
                        <div style="font-weight: 500; margin-bottom: 0.25rem;">[\${timestamp}]</div>
                        <div>\${message}</div>
                    </div>
                \`;
                
                results.appendChild(resultItem);
                results.scrollTop = results.scrollHeight;
            }
            
            function testHealth() {
                showResult('正在检查系统健康状态...', 'info');
                fetch('/health')
                    .then(response => response.json())
                    .then(data => {
                        showResult('健康检查成功: ' + data.message, 'success');
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
                    showResult('搜索功能开发中...', 'warning');
                }
            }
            
            function loadUsers() {
                showResult('正在加载用户列表...', 'info');
                
                fetch('/api/users')
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showResult('用户加载成功，共 ' + data.total + ' 个用户', 'success');
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
                showResult('用户统计功能开发中...', 'warning');
            }
            
            function loadLogs() {
                showResult('正在加载系统日志...', 'info');
                
                fetch('/api/logs')
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showResult('日志加载成功，共 ' + data.total + ' 条日志', 'success');
                        } else {
                            showResult('日志加载失败', 'error');
                        }
                    })
                    .catch(error => {
                        showResult('日志加载失败: ' + error.message, 'error');
                    });
            }
            
            function createBackup() {
                showResult('数据备份功能开发中...', 'warning');
            }
            
            function exportData() {
                showResult('数据导出功能开发中...', 'warning');
            }
            
            function resetStats() {
                if (confirm('确定要重置统计数据吗？此操作不可恢复！')) {
                    showResult('统计数据重置功能开发中...', 'warning');
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
  console.log(`🎨 拾光豆现代化管理系统启动成功！`);
  console.log(`📡 服务器地址: http://${HOST}:${PORT}`);
  console.log(`🔌 WebSocket地址: ws://${HOST}:${PORT}`);
  console.log(`🏥 健康检查: http://${HOST}:${PORT}/health`);
  console.log(`📊 系统状态: http://${HOST}:${PORT}/api/status`);
  console.log(`🗄️ 现代化文件数据库模式运行中，数据存储在: ${db.dataDir}`);
  console.log(`🎤 语音识别: 微信自带识别（完全免费）`);
  console.log(`💰 费用: 完全免费，无任何收费项目`);
  
  // 添加启动日志
  db.addLog('info', '现代化管理系统启动完成', {
    port: PORT,
    host: HOST,
    mode: 'modern-file-database'
  });
});

module.exports = app;
