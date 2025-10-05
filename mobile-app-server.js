const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

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

// 静态文件服务
app.use(express.static(path.join(__dirname)));

// 提供移动端App页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'mobile-app.html'));
});

// WebSocket连接处理
io.on('connection', (socket) => {
  console.log(`📱 移动端App客户端连接: ${socket.id}`);
  
  // 用户登录
  socket.on('user_login', (data) => {
    console.log(`👤 用户登录: ${data.userName} (${data.userId})`);
    
    // 绑定用户ID到socket
    socket.userId = data.userId;
    socket.userName = data.userName;
    
    // 发送登录成功消息
    socket.emit('login_success', {
      userId: data.userId,
      userName: data.userName,
      timestamp: new Date()
    });
  });
  
  // 心跳检测
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date() });
  });
  
  // 断开连接
  socket.on('disconnect', () => {
    console.log(`📱 移动端App客户端断开: ${socket.id}`);
  });
});

// 启动服务器
const PORT = 3002;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`📱 拾光豆移动端App服务器启动成功！`);
  console.log(`🌐 访问地址: http://${HOST}:${PORT}`);
  console.log(`🔌 WebSocket地址: ws://${HOST}:${PORT}`);
  console.log(`📱 移动端界面: http://${HOST}:${PORT}`);
});

module.exports = app;
