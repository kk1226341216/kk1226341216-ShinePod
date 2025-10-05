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

// 🆓 免费文件数据库
class FreeFileDatabase {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.messagesFile = path.join(this.dataDir, 'messages.json');
    this.usersFile = path.join(this.dataDir, 'users.json');
    this.statsFile = path.join(this.dataDir, 'stats.json');
    
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    this.initDataFiles();
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
  
  readStats() {
    try {
      const data = fs.readFileSync(this.statsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return this.getDefaultStats();
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
    fs.writeFileSync(this.statsFile, JSON.stringify(stats, null, 2));
    
    return message;
  }
  
  getStats() {
    return this.readStats();
  }
}

// 初始化数据库
const freeDB = new FreeFileDatabase();

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
  const stats = freeDB.getStats();
  res.status(200).json({ 
    status: 'ok', 
    message: '拾光豆B端管理系统运行正常',
    mode: 'free-file-database',
    stats: stats,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/status', (req, res) => {
  const stats = freeDB.getStats();
  res.status(200).json({
    service: '拾光豆B端管理系统',
    version: '2.0.0',
    mode: 'free-file-database',
    status: 'running',
    stats: stats,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/stats', (req, res) => {
  const stats = freeDB.getStats();
  res.status(200).json({
    success: true,
    data: stats,
    mode: 'free-file-database'
  });
});

app.get('/api/messages', (req, res) => {
  const messages = freeDB.readMessages();
  res.status(200).json({
    success: true,
    data: messages,
    total: messages.length
  });
});

app.post('/api/simulate-message', (req, res) => {
  const message = {
    user_id: 'admin_' + Date.now(),
    content_type: 'text',
    raw_content: '管理员测试消息',
    converted_text: '管理员测试消息'
  };
  
  const result = freeDB.addMessage(message);
  
  // 通过WebSocket广播新消息
  io.emit('new_message', result);
  
  res.status(200).json({
    success: true,
    data: result,
    message: '消息发送成功'
  });
});

// 🎨 现代化B端管理系统界面
app.get('/', (req, res) => {
  const stats = freeDB.getStats();
  res.send(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>拾光豆 B端管理系统</title>
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
                grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
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
            
            .btn-info {
                background: var(--info-color);
                color: white;
            }
            
            .btn-info:hover {
                background: #0891b2;
                transform: translateY(-1px);
            }
            
            .tabs {
                display: flex;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                border-radius: 12px;
                padding: 0.5rem;
                margin-bottom: 2rem;
                box-shadow: var(--shadow-md);
                border: 1px solid var(--border-color);
            }
            
            .tab {
                flex: 1;
                padding: 0.75rem 1rem;
                text-align: center;
                cursor: pointer;
                border-radius: 8px;
                transition: all 0.2s ease;
                font-weight: 500;
                color: var(--text-secondary);
            }
            
            .tab.active {
                background: var(--primary-color);
                color: white;
                box-shadow: var(--shadow-sm);
            }
            
            .tab-content {
                display: none;
            }
            
            .tab-content.active {
                display: block;
            }
            
            .message-list {
                max-height: 400px;
                overflow-y: auto;
                border: 1px solid var(--border-color);
                border-radius: 12px;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
            }
            
            .message-item {
                padding: 1rem;
                border-bottom: 1px solid var(--border-color);
                transition: background-color 0.2s ease;
            }
            
            .message-item:hover {
                background: var(--light-color);
            }
            
            .message-item:last-child {
                border-bottom: none;
            }
            
            .message-meta {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 0.5rem;
                font-size: 0.875rem;
                color: var(--text-secondary);
            }
            
            .message-content {
                font-size: 0.9rem;
                color: var(--text-primary);
                line-height: 1.5;
            }
            
            .log-container {
                background: var(--dark-color);
                color: #e2e8f0;
                padding: 1rem;
                border-radius: 12px;
                font-family: 'Monaco', 'Menlo', monospace;
                font-size: 0.875rem;
                max-height: 300px;
                overflow-y: auto;
                border: 1px solid #374151;
            }
            
            .log-entry {
                margin-bottom: 0.5rem;
                padding: 0.25rem 0;
                border-bottom: 1px solid #374151;
            }
            
            .log-time {
                color: #9ca3af;
            }
            
            .log-level-info { color: #10b981; }
            .log-level-error { color: #ef4444; }
            .log-level-warn { color: #f59e0b; }
            
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
            
            .toast {
                position: fixed;
                top: 2rem;
                right: 2rem;
                padding: 1rem 1.5rem;
                border-radius: 12px;
                color: white;
                font-weight: 500;
                box-shadow: var(--shadow-xl);
                transform: translateX(400px);
                transition: transform 0.3s ease;
                z-index: 1000;
            }
            
            .toast.show {
                transform: translateX(0);
            }
            
            .toast.success { background: var(--success-color); }
            .toast.error { background: var(--danger-color); }
            .toast.warning { background: var(--warning-color); }
            .toast.info { background: var(--info-color); }
            
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
                
                .tabs {
                    flex-direction: column;
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
                        <div class="logo-text">拾光豆管理系统</div>
                    </div>
                    <div class="status-indicator">
                        <div class="status-dot"></div>
                        <span>系统运行正常</span>
                    </div>
                </div>
            </header>

            <main class="main-content">
                <div class="tabs">
                    <div class="tab active" onclick="switchTab('dashboard')">
                        <i class="fas fa-chart-pie"></i> 仪表盘
                    </div>
                    <div class="tab" onclick="switchTab('messages')">
                        <i class="fas fa-comments"></i> 消息管理
                    </div>
                    <div class="tab" onclick="switchTab('users')">
                        <i class="fas fa-users"></i> 用户管理
                    </div>
                    <div class="tab" onclick="switchTab('logs')">
                        <i class="fas fa-file-alt"></i> 系统日志
                    </div>
                    <div class="tab" onclick="switchTab('settings')">
                        <i class="fas fa-cog"></i> 系统设置
                    </div>
                </div>

                <!-- 仪表盘 -->
                <div id="dashboard" class="tab-content active">
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
                            <div class="card-header">
                                <h3 class="card-title">快速操作</h3>
                                <div class="card-icon" style="background: var(--success-color);">
                                    <i class="fas fa-bolt"></i>
                                </div>
                            </div>
                            <div class="actions-grid">
                                <button class="btn btn-primary" onclick="testHealth()">
                                    <i class="fas fa-heartbeat"></i> 健康检查
                                </button>
                                <button class="btn btn-success" onclick="testWebSocket()">
                                    <i class="fas fa-wifi"></i> WebSocket测试
                                </button>
                                <button class="btn btn-warning" onclick="simulateMessage()">
                                    <i class="fas fa-paper-plane"></i> 模拟消息
                                </button>
                                <button class="btn btn-info" onclick="refreshStats()">
                                    <i class="fas fa-sync-alt"></i> 刷新统计
                                </button>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">今日使用</h3>
                                <div class="card-icon" style="background: var(--warning-color);">
                                    <i class="fas fa-calendar-day"></i>
                                </div>
                            </div>
                            <div class="stats-grid">
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
                        <div class="card-header">
                            <h3 class="card-title">消息管理</h3>
                            <div class="actions-grid">
                                <button class="btn btn-primary" onclick="loadMessages()">
                                    <i class="fas fa-download"></i> 加载消息
                                </button>
                                <button class="btn btn-success" onclick="searchMessages()">
                                    <i class="fas fa-search"></i> 搜索消息
                                </button>
                                <button class="btn btn-warning" onclick="exportMessages()">
                                    <i class="fas fa-file-export"></i> 导出数据
                                </button>
                            </div>
                        </div>
                        <div id="messageList" class="message-list">
                            <div style="text-align: center; color: var(--text-secondary); padding: 3rem;">
                                <i class="fas fa-comments" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                                <p>点击"加载消息"查看消息列表</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 用户管理 -->
                <div id="users" class="tab-content">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">用户管理</h3>
                            <div class="actions-grid">
                                <button class="btn btn-primary" onclick="loadUsers()">
                                    <i class="fas fa-users"></i> 加载用户
                                </button>
                                <button class="btn btn-success" onclick="addUser()">
                                    <i class="fas fa-user-plus"></i> 添加用户
                                </button>
                                <button class="btn btn-warning" onclick="userStats()">
                                    <i class="fas fa-chart-line"></i> 用户统计
                                </button>
                            </div>
                        </div>
                        <div id="userList" class="message-list">
                            <div style="text-align: center; color: var(--text-secondary); padding: 3rem;">
                                <i class="fas fa-users" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                                <p>用户管理功能开发中...</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 系统日志 -->
                <div id="logs" class="tab-content">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">系统日志</h3>
                            <div class="actions-grid">
                                <button class="btn btn-primary" onclick="loadLogs()">
                                    <i class="fas fa-download"></i> 加载日志
                                </button>
                                <button class="btn btn-warning" onclick="clearLogs()">
                                    <i class="fas fa-trash"></i> 清空日志
                                </button>
                                <button class="btn btn-info" onclick="downloadLogs()">
                                    <i class="fas fa-file-download"></i> 下载日志
                                </button>
                            </div>
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
                        <div class="card-header">
                            <h3 class="card-title">系统设置</h3>
                            <div class="actions-grid">
                                <button class="btn btn-primary" onclick="systemInfo()">
                                    <i class="fas fa-info-circle"></i> 系统信息
                                </button>
                                <button class="btn btn-success" onclick="backupData()">
                                    <i class="fas fa-database"></i> 备份数据
                                </button>
                                <button class="btn btn-warning" onclick="resetStats()">
                                    <i class="fas fa-redo"></i> 重置统计
                                </button>
                                <button class="btn btn-info" onclick="restartService()">
                                    <i class="fas fa-power-off"></i> 重启服务
                                </button>
                            </div>
                        </div>
                        <div id="settingsInfo" style="margin-top: 1rem; padding: 1.5rem; background: var(--light-color); border-radius: 12px; border: 1px solid var(--border-color);">
                            <h4 style="margin-bottom: 1rem; color: var(--text-primary);">系统配置信息</h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
                                <div><strong>服务模式:</strong> 免费文件数据库模式</div>
                                <div><strong>语音识别:</strong> 微信自带识别（完全免费）</div>
                                <div><strong>数据存储:</strong> ${freeDB.dataDir}</div>
                                <div><strong>WebSocket:</strong> ws://localhost:3000</div>
                            </div>
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
            let currentTab = 'dashboard';

            function switchTab(tabName) {
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                
                document.querySelectorAll('.tab').forEach(tab => {
                    tab.classList.remove('active');
                });
                
                document.getElementById(tabName).classList.add('active');
                event.target.classList.add('active');
                
                currentTab = tabName;
            }

            function showToast(message, type = 'info') {
                const toast = document.createElement('div');
                toast.className = 'toast ' + type;
                toast.textContent = message;
                document.body.appendChild(toast);
                
                setTimeout(() => toast.classList.add('show'), 100);
                setTimeout(() => {
                    toast.classList.remove('show');
                    setTimeout(() => document.body.removeChild(toast), 300);
                }, 3000);
            }

            function testHealth() {
                showToast('正在检查系统健康状态...', 'info');
                fetch('/health')
                    .then(response => response.json())
                    .then(data => {
                        showToast('健康检查成功！', 'success');
                        console.log('健康检查结果:', data);
                    })
                    .catch(error => {
                        showToast('健康检查失败: ' + error.message, 'error');
                    });
            }

            function testWebSocket() {
                showToast('正在测试WebSocket连接...', 'info');
                
                if (ws) {
                    ws.close();
                }
                
                ws = new WebSocket('ws://localhost:3000');
                
                ws.onopen = () => {
                    showToast('WebSocket连接成功！', 'success');
                    addLog('WebSocket连接建立', 'info');
                };
                
                ws.onmessage = (event) => {
                    addLog('收到消息: ' + event.data, 'info');
                };
                
                ws.onerror = (error) => {
                    showToast('WebSocket连接失败', 'error');
                    addLog('WebSocket连接失败', 'error');
                };
                
                ws.onclose = () => {
                    addLog('WebSocket连接关闭', 'warn');
                };
            }

            function simulateMessage() {
                showToast('正在发送模拟消息...', 'info');
                
                fetch('/api/simulate-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showToast('消息发送成功！', 'success');
                            addLog('模拟消息发送成功', 'info');
                            refreshStats();
                        } else {
                            showToast('消息发送失败', 'error');
                        }
                    })
                    .catch(error => {
                        showToast('消息发送失败: ' + error.message, 'error');
                        addLog('模拟消息发送失败: ' + error.message, 'error');
                    });
            }

            function refreshStats() {
                showToast('正在刷新统计数据...', 'info');
                fetch('/api/stats')
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showToast('统计数据已刷新', 'success');
                            setTimeout(() => location.reload(), 1000);
                        }
                    })
                    .catch(error => {
                        showToast('刷新失败: ' + error.message, 'error');
                    });
            }

            function loadMessages() {
                showToast('正在加载消息列表...', 'info');
                fetch('/api/messages')
                    .then(response => response.json())
                    .then(data => {
                        const container = document.getElementById('messageList');
                        if (data.success && data.data.length > 0) {
                            container.innerHTML = data.data.map(msg => 
                                '<div class="message-item">' +
                                    '<div class="message-meta">' +
                                        '<span><i class="fas fa-user"></i> ' + msg.user_id + '</span>' +
                                        '<span><i class="fas fa-tag"></i> ' + msg.content_type + '</span>' +
                                        '<span><i class="fas fa-clock"></i> ' + new Date(msg.created_at).toLocaleString() + '</span>' +
                                    '</div>' +
                                    '<div class="message-content">' + (msg.converted_text || msg.raw_content) + '</div>' +
                                '</div>'
                            ).join('');
                            showToast('消息加载成功', 'success');
                        } else {
                            container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 3rem;"><i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i><p>暂无消息数据</p></div>';
                            showToast('暂无消息数据', 'warning');
                        }
                    })
                    .catch(error => {
                        document.getElementById('messageList').innerHTML = '<div style="text-align: center; color: var(--danger-color); padding: 3rem;"><i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem;"></i><p>加载失败: ' + error.message + '</p></div>';
                        showToast('消息加载失败: ' + error.message, 'error');
                    });
            }

            function searchMessages() {
                const keyword = prompt('请输入搜索关键词:');
                if (keyword) {
                    showToast('正在搜索消息...', 'info');
                    // 这里可以实现搜索功能
                    showToast('搜索功能开发中...', 'warning');
                }
            }

            function exportMessages() {
                showToast('正在导出消息数据...', 'info');
                fetch('/api/messages')
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
                            showToast('消息数据导出成功', 'success');
                        }
                    })
                    .catch(error => {
                        showToast('导出失败: ' + error.message, 'error');
                    });
            }

            function loadUsers() {
                showToast('用户管理功能开发中...', 'warning');
            }

            function addUser() {
                showToast('添加用户功能开发中...', 'warning');
            }

            function userStats() {
                showToast('用户统计功能开发中...', 'warning');
            }

            function loadLogs() {
                addLog('加载系统日志', 'info');
                showToast('日志已加载', 'success');
            }

            function clearLogs() {
                document.getElementById('logContainer').innerHTML = '';
                addLog('日志已清空', 'warn');
                showToast('日志已清空', 'warning');
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
                showToast('日志下载成功', 'success');
            }

            function systemInfo() {
                fetch('/api/status')
                    .then(response => response.json())
                    .then(data => {
                        alert('系统信息：\\n' + JSON.stringify(data, null, 2));
                    })
                    .catch(error => {
                        showToast('获取系统信息失败: ' + error.message, 'error');
                    });
            }

            function backupData() {
                showToast('数据备份功能开发中...', 'warning');
            }

            function resetStats() {
                if (confirm('确定要重置统计信息吗？此操作不可恢复！')) {
                    showToast('重置统计功能开发中...', 'warning');
                }
            }

            function restartService() {
                if (confirm('确定要重启服务吗？')) {
                    showToast('服务重启功能开发中...', 'warning');
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
                showToast('正在刷新所有数据...', 'info');
                setTimeout(() => location.reload(), 1000);
            }

            // 页面加载完成后自动连接WebSocket
            window.onload = function() {
                addLog('B端管理系统加载完成', 'info');
                showToast('系统加载完成', 'success');
                testWebSocket();
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
  console.log(`🎨 拾光豆现代化B端管理系统启动成功！`);
  console.log(`📡 服务器地址: http://${HOST}:${PORT}`);
  console.log(`🔌 WebSocket地址: ws://${HOST}:${PORT}`);
  console.log(`🏥 健康检查: http://${HOST}:${PORT}/health`);
  console.log(`📊 系统状态: http://${HOST}:${PORT}/api/status`);
  console.log(`🗄️ 文件数据库模式运行中，数据存储在: ${freeDB.dataDir}`);
  console.log(`🎤 语音识别: 微信自带识别（完全免费）`);
  console.log(`💰 费用: 完全免费，无任何收费项目`);
});

module.exports = app;
