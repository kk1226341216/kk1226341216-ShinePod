const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// 创建Express应用
const app = express();
const server = http.createServer(app);

// 初始化Socket.io
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// 静态文件服务
app.use(express.static('public'));

// 模拟数据
const mockUsers = [
  { id: 'user_001', name: '张三', avatar: '👨', lastActive: new Date() },
  { id: 'user_002', name: '李四', avatar: '👩', lastActive: new Date() },
  { id: 'user_003', name: '王五', avatar: '👨‍💼', lastActive: new Date() }
];

const mockMessages = [
  {
    id: 'msg_001',
    userId: 'user_001',
    type: 'text',
    content: '今天天气真不错！',
    timestamp: new Date(Date.now() - 3600000),
    status: 'synced'
  },
  {
    id: 'msg_002',
    userId: 'user_001',
    type: 'voice',
    content: '这是一条语音消息',
    voiceText: '今天下午3点开会，请大家准时参加',
    timestamp: new Date(Date.now() - 1800000),
    status: 'synced'
  },
  {
    id: 'msg_003',
    userId: 'user_002',
    type: 'text',
    content: '好的，收到！',
    timestamp: new Date(Date.now() - 900000),
    status: 'synced'
  },
  {
    id: 'msg_004',
    userId: 'user_003',
    type: 'voice',
    content: '语音消息',
    voiceText: '会议地点在会议室A，记得带笔记本',
    timestamp: new Date(Date.now() - 300000),
    status: 'pending'
  }
];

// WebSocket连接管理
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('📱 App客户端连接:', socket.id);
  
  // 用户登录
  socket.on('user_login', (data) => {
    const { userId, userName } = data;
    connectedUsers.set(socket.id, { userId, userName, socket });
    socket.userId = userId;
    
    console.log(`👤 用户登录: ${userName} (${userId})`);
    
    // 发送登录成功消息
    socket.emit('login_success', {
      userId,
      userName,
      timestamp: new Date()
    });
    
    // 发送历史消息
    const userMessages = mockMessages.filter(msg => msg.userId === userId);
    socket.emit('history_messages', {
      messages: userMessages,
      total: userMessages.length
    });
    
    // 通知其他用户
    socket.broadcast.emit('user_online', {
      userId,
      userName,
      timestamp: new Date()
    });
  });
  
  // 发送消息
  socket.on('send_message', (data) => {
    const { type, content, voiceText } = data;
    const userId = socket.userId;
    const user = connectedUsers.get(socket.id);
    
    if (!userId || !user) {
      socket.emit('error', { message: '用户未登录' });
      return;
    }
    
    const newMessage = {
      id: 'msg_' + Date.now(),
      userId,
      type,
      content,
      voiceText,
      timestamp: new Date(),
      status: 'pending'
    };
    
    mockMessages.push(newMessage);
    
    console.log(`💬 新消息: ${user.userName} - ${content || voiceText}`);
    
    // 发送给发送者
    socket.emit('message_sent', {
      message: newMessage,
      status: 'success'
    });
    
    // 广播给所有用户
    io.emit('new_message', {
      message: newMessage,
      sender: user.userName
    });
    
    // 模拟消息处理
    setTimeout(() => {
      newMessage.status = 'synced';
      io.emit('message_status_update', {
        messageId: newMessage.id,
        status: 'synced'
      });
    }, 2000);
  });
  
  // 心跳检测
  socket.on('ping', () => {
    socket.emit('pong');
  });
  
  // 断开连接
  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      console.log(`👋 用户离线: ${user.userName}`);
      
      // 通知其他用户
      socket.broadcast.emit('user_offline', {
        userId: user.userId,
        userName: user.userName,
        timestamp: new Date()
      });
      
      connectedUsers.delete(socket.id);
    }
  });
});

// App模拟器主页
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>拾光豆 App 模拟器</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #f5f5f5;
                height: 100vh;
                overflow: hidden;
            }
            
            .phone-container {
                width: 375px;
                height: 812px;
                margin: 20px auto;
                background: #000;
                border-radius: 25px;
                padding: 8px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                position: relative;
            }
            
            .phone-screen {
                width: 100%;
                height: 100%;
                background: #fff;
                border-radius: 20px;
                overflow: hidden;
                position: relative;
            }
            
            .status-bar {
                height: 44px;
                background: #000;
                color: #fff;
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0 20px;
                font-size: 14px;
                font-weight: 600;
            }
            
            .app-header {
                height: 60px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                font-weight: bold;
                position: relative;
            }
            
            .user-info {
                position: absolute;
                right: 15px;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
            }
            
            .messages-container {
                height: calc(100% - 104px);
                overflow-y: auto;
                padding: 10px;
                background: #f8f9fa;
            }
            
            .message {
                margin: 10px 0;
                display: flex;
                align-items: flex-start;
                gap: 10px;
            }
            
            .message.own {
                flex-direction: row-reverse;
            }
            
            .message-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: #e9ecef;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                flex-shrink: 0;
            }
            
            .message-content {
                max-width: 70%;
                background: white;
                padding: 12px 16px;
                border-radius: 18px;
                box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                position: relative;
            }
            
            .message.own .message-content {
                background: #007bff;
                color: white;
            }
            
            .message-text {
                font-size: 16px;
                line-height: 1.4;
            }
            
            .message-time {
                font-size: 12px;
                color: #6c757d;
                margin-top: 4px;
            }
            
            .message.own .message-time {
                color: rgba(255,255,255,0.8);
            }
            
            .voice-message {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .voice-icon {
                width: 20px;
                height: 20px;
                background: #007bff;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 12px;
            }
            
            .voice-text {
                font-style: italic;
                color: #6c757d;
            }
            
            .message-status {
                position: absolute;
                right: -25px;
                top: 50%;
                transform: translateY(-50%);
                font-size: 12px;
                color: #6c757d;
            }
            
            .message.own .message-status {
                left: -25px;
                right: auto;
            }
            
            .input-container {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 60px;
                background: white;
                border-top: 1px solid #e9ecef;
                display: flex;
                align-items: center;
                padding: 0 15px;
                gap: 10px;
            }
            
            .input-field {
                flex: 1;
                height: 36px;
                border: 1px solid #e9ecef;
                border-radius: 18px;
                padding: 0 15px;
                font-size: 16px;
                outline: none;
            }
            
            .input-field:focus {
                border-color: #007bff;
            }
            
            .send-btn {
                width: 36px;
                height: 36px;
                background: #007bff;
                border: none;
                border-radius: 50%;
                color: white;
                font-size: 16px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .voice-btn {
                width: 36px;
                height: 36px;
                background: #28a745;
                border: none;
                border-radius: 50%;
                color: white;
                font-size: 16px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .login-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            }
            
            .login-form {
                background: white;
                padding: 30px;
                border-radius: 15px;
                width: 280px;
                text-align: center;
            }
            
            .login-form h3 {
                margin-bottom: 20px;
                color: #333;
            }
            
            .login-form input {
                width: 100%;
                height: 40px;
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 0 15px;
                margin-bottom: 15px;
                font-size: 16px;
            }
            
            .login-form button {
                width: 100%;
                height: 40px;
                background: #007bff;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                cursor: pointer;
            }
            
            .connection-status {
                position: absolute;
                top: 10px;
                left: 10px;
                padding: 5px 10px;
                border-radius: 15px;
                font-size: 12px;
                font-weight: bold;
            }
            
            .status-connected {
                background: #d4edda;
                color: #155724;
            }
            
            .status-disconnected {
                background: #f8d7da;
                color: #721c24;
            }
            
            .typing-indicator {
                padding: 10px 15px;
                font-style: italic;
                color: #6c757d;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="phone-container">
            <div class="phone-screen">
                <div class="status-bar">
                    <span>9:41</span>
                    <span>拾光豆</span>
                    <span>100%</span>
                </div>
                
                <div class="app-header">
                    <span>拾光豆</span>
                    <div class="user-info">
                        <span id="userAvatar">👤</span>
                        <span id="userName">未登录</span>
                    </div>
                </div>
                
                <div class="connection-status status-disconnected" id="connectionStatus">
                    未连接
                </div>
                
                <div class="messages-container" id="messagesContainer">
                    <div class="typing-indicator" id="typingIndicator" style="display: none;">
                        正在输入...
                    </div>
                </div>
                
                <div class="input-container">
                    <input type="text" class="input-field" id="messageInput" placeholder="输入消息..." disabled>
                    <button class="voice-btn" id="voiceBtn" onclick="sendVoiceMessage()" disabled>🎤</button>
                    <button class="send-btn" id="sendBtn" onclick="sendMessage()" disabled>📤</button>
                </div>
                
                <div class="login-overlay" id="loginOverlay">
                    <div class="login-form">
                        <h3>登录拾光豆</h3>
                        <input type="text" id="userNameInput" placeholder="用户名" value="张三">
                        <input type="text" id="userIdInput" placeholder="用户ID" value="user_001">
                        <button onclick="login()">登录</button>
                    </div>
                </div>
            </div>
        </div>
        
        <script src="/socket.io/socket.io.js"></script>
        <script>
            let socket = null;
            let currentUser = null;
            let isConnected = false;
            
            // 初始化
            function init() {
                socket = io();
                
                socket.on('connect', () => {
                    console.log('📱 连接到服务器');
                    updateConnectionStatus(true);
                });
                
                socket.on('disconnect', () => {
                    console.log('📱 与服务器断开连接');
                    updateConnectionStatus(false);
                });
                
                socket.on('login_success', (data) => {
                    console.log('✅ 登录成功:', data);
                    currentUser = data;
                    document.getElementById('userName').textContent = data.userName;
                    document.getElementById('userAvatar').textContent = getAvatar(data.userId);
                    document.getElementById('loginOverlay').style.display = 'none';
                    enableInput();
                });
                
                socket.on('history_messages', (data) => {
                    console.log('📜 历史消息:', data);
                    data.messages.forEach(msg => addMessage(msg));
                });
                
                socket.on('new_message', (data) => {
                    console.log('💬 新消息:', data);
                    addMessage(data.message);
                });
                
                socket.on('message_sent', (data) => {
                    console.log('📤 消息发送成功:', data);
                    updateMessageStatus(data.message.id, 'synced');
                });
                
                socket.on('message_status_update', (data) => {
                    console.log('🔄 消息状态更新:', data);
                    updateMessageStatus(data.messageId, data.status);
                });
                
                socket.on('user_online', (data) => {
                    console.log('👤 用户上线:', data);
                    showNotification(data.userName + ' 上线了');
                });
                
                socket.on('user_offline', (data) => {
                    console.log('👋 用户离线:', data);
                    showNotification(data.userName + ' 离线了');
                });
                
                socket.on('pong', () => {
                    console.log('🏓 收到心跳响应');
                });
            }
            
            function login() {
                const userName = document.getElementById('userNameInput').value;
                const userId = document.getElementById('userIdInput').value;
                
                if (!userName || !userId) {
                    alert('请输入用户名和用户ID');
                    return;
                }
                
                socket.emit('user_login', { userId, userName });
            }
            
            function sendMessage() {
                const input = document.getElementById('messageInput');
                const content = input.value.trim();
                
                if (!content) return;
                
                socket.emit('send_message', {
                    type: 'text',
                    content: content
                });
                
                input.value = '';
            }
            
            function sendVoiceMessage() {
                const voiceText = prompt('请输入语音识别结果:');
                if (!voiceText) return;
                
                socket.emit('send_message', {
                    type: 'voice',
                    content: '语音消息',
                    voiceText: voiceText
                });
            }
            
            function addMessage(message) {
                const container = document.getElementById('messagesContainer');
                const messageDiv = document.createElement('div');
                messageDiv.className = 'message' + (message.userId === currentUser?.userId ? ' own' : '');
                messageDiv.id = 'msg_' + message.id;
                
                const avatar = getAvatar(message.userId);
                const time = formatTime(message.timestamp);
                const status = getStatusIcon(message.status);
                
                let contentHtml = '';
                if (message.type === 'voice') {
                    contentHtml = \`
                        <div class="voice-message">
                            <div class="voice-icon">🎤</div>
                            <div class="voice-text">\${message.voiceText}</div>
                        </div>
                    \`;
                } else {
                    contentHtml = \`<div class="message-text">\${message.content}</div>\`;
                }
                
                messageDiv.innerHTML = \`
                    <div class="message-avatar">\${avatar}</div>
                    <div class="message-content">
                        \${contentHtml}
                        <div class="message-time">\${time}</div>
                        <div class="message-status">\${status}</div>
                    </div>
                \`;
                
                container.appendChild(messageDiv);
                container.scrollTop = container.scrollHeight;
            }
            
            function updateMessageStatus(messageId, status) {
                const messageDiv = document.getElementById('msg_' + messageId);
                if (messageDiv) {
                    const statusElement = messageDiv.querySelector('.message-status');
                    if (statusElement) {
                        statusElement.textContent = getStatusIcon(status);
                    }
                }
            }
            
            function getAvatar(userId) {
                const avatars = {
                    'user_001': '👨',
                    'user_002': '👩', 
                    'user_003': '👨‍💼'
                };
                return avatars[userId] || '👤';
            }
            
            function getStatusIcon(status) {
                const icons = {
                    'pending': '⏳',
                    'synced': '✅',
                    'failed': '❌'
                };
                return icons[status] || '⏳';
            }
            
            function formatTime(timestamp) {
                const date = new Date(timestamp);
                return date.toLocaleTimeString('zh-CN', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
            }
            
            function updateConnectionStatus(connected) {
                isConnected = connected;
                const statusElement = document.getElementById('connectionStatus');
                if (connected) {
                    statusElement.className = 'connection-status status-connected';
                    statusElement.textContent = '已连接';
                } else {
                    statusElement.className = 'connection-status status-disconnected';
                    statusElement.textContent = '未连接';
                }
            }
            
            function enableInput() {
                document.getElementById('messageInput').disabled = false;
                document.getElementById('sendBtn').disabled = false;
                document.getElementById('voiceBtn').disabled = false;
            }
            
            function showNotification(message) {
                // 简单的通知实现
                console.log('🔔 通知:', message);
            }
            
            // 键盘事件
            document.getElementById('messageInput').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    sendMessage();
                }
            });
            
            // 心跳检测
            setInterval(() => {
                if (socket && isConnected) {
                    socket.emit('ping');
                }
            }, 30000);
            
            // 初始化应用
            init();
        </script>
    </body>
    </html>
  `);
});

// 启动服务器
const PORT = 3001;
server.listen(PORT, () => {
  console.log('📱 拾光豆 App 模拟器启动成功！');
  console.log(`🌐 访问地址: http://localhost:${PORT}`);
  console.log('🎯 功能: 模拟移动端App界面和WebSocket通信');
});

module.exports = app;
