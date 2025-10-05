// 增强版WebSocket工具类 - 优化连接稳定性
class EnhancedWebSocketUtils {
  constructor() {
    this.clients = new Map(); // 存储客户端连接
    this.heartbeatInterval = 30000; // 心跳间隔30秒
    this.connectionTimeout = 60000; // 连接超时60秒
    this.maxReconnectAttempts = 5; // 最大重连次数
    this.logger = require('./logger');
    this.heartbeatTimer = null;
    this.connectionStats = {
      totalConnections: 0,
      activeConnections: 0,
      failedConnections: 0,
      reconnections: 0
    };
  }

  // 初始化WebSocket服务
  init(io) {
    this.io = io;
    
    // 配置Socket.io选项
    this.configureSocketIO();
    
    // 监听连接事件
    io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
    
    // 启动心跳检测
    this.startHeartbeat();
    
    // 启动连接监控
    this.startConnectionMonitoring();
    
    this.logger.info('增强版WebSocket服务初始化成功');
  }

  // 配置Socket.io选项
  configureSocketIO() {
    this.io.engine.on('connection_error', (err) => {
      this.logger.error('WebSocket连接错误', { error: err.message });
      this.connectionStats.failedConnections++;
    });
  }

  // 处理新连接
  handleConnection(socket) {
    this.logger.info('新的WebSocket连接建立', { 
      socketId: socket.id,
      clientIP: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent']
    });
    
    // 更新统计信息
    this.connectionStats.totalConnections++;
    this.connectionStats.activeConnections++;
    
    // 设置连接超时
    socket.connectionTimeout = setTimeout(() => {
      if (!socket.userId) {
        this.logger.warn('连接超时，用户未登录', { socketId: socket.id });
        socket.disconnect(true);
      }
    }, this.connectionTimeout);
    
    // 监听用户登录事件
    socket.on('user_login', (data) => {
      this.handleUserLogin(socket, data);
    });
    
    // 监听心跳包
    socket.on('ping', () => {
      this.handlePing(socket);
    });
    
    // 监听重连事件
    socket.on('reconnect', (data) => {
      this.handleReconnect(socket, data);
    });
    
    // 监听断开连接事件
    socket.on('disconnect', (reason) => {
      this.handleDisconnect(socket, reason);
    });
    
    // 监听错误事件
    socket.on('error', (error) => {
      this.handleError(socket, error);
    });
  }

  // 处理用户登录
  handleUserLogin(socket, data) {
    const userId = data.userId || data;
    const userName = data.userName || '未知用户';
    
    if (!userId) {
      this.logger.warn('用户ID为空，无法建立连接', { socketId: socket.id });
      socket.emit('login_failed', { message: '用户ID不能为空' });
      return;
    }
    
    // 清除连接超时
    if (socket.connectionTimeout) {
      clearTimeout(socket.connectionTimeout);
      socket.connectionTimeout = null;
    }
    
    // 存储用户和socket的映射关系
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    
    this.clients.get(userId).add(socket);
    socket.userId = userId;
    socket.userName = userName;
    socket.lastPing = Date.now();
    socket.reconnectAttempts = 0;
    
    this.logger.info('用户登录WebSocket成功', { 
      userId, 
      userName,
      socketId: socket.id,
      totalConnections: this.getTotalConnectionsCount()
    });
    
    socket.emit('login_success', { 
      userId, 
      userName,
      timestamp: new Date().toISOString()
    });
  }

  // 处理心跳包
  handlePing(socket) {
    socket.lastPing = Date.now();
    socket.emit('pong', { 
      timestamp: new Date().toISOString(),
      serverTime: Date.now()
    });
  }

  // 处理重连
  handleReconnect(socket, data) {
    const userId = data.userId || socket.userId;
    
    if (userId) {
      socket.reconnectAttempts = (socket.reconnectAttempts || 0) + 1;
      
      if (socket.reconnectAttempts <= this.maxReconnectAttempts) {
        this.logger.info('用户重连WebSocket', { 
          userId, 
          socketId: socket.id,
          attempt: socket.reconnectAttempts
        });
        
        this.connectionStats.reconnections++;
        socket.emit('reconnect_success', { 
          userId,
          attempt: socket.reconnectAttempts
        });
      } else {
        this.logger.warn('用户重连次数超限', { 
          userId, 
          socketId: socket.id,
          attempts: socket.reconnectAttempts
        });
        
        socket.emit('reconnect_failed', { 
          message: '重连次数超限，请重新登录'
        });
      }
    }
  }

  // 处理断开连接
  handleDisconnect(socket, reason) {
    const { userId, userName } = socket;
    
    this.connectionStats.activeConnections--;
    
    if (userId && this.clients.has(userId)) {
      const userSockets = this.clients.get(userId);
      userSockets.delete(socket);
      
      // 如果用户没有其他连接，则从映射中删除
      if (userSockets.size === 0) {
        this.clients.delete(userId);
      }
      
      this.logger.info('用户断开WebSocket连接', { 
        userId, 
        userName,
        socketId: socket.id,
        reason,
        remainingConnections: userSockets.size
      });
    } else {
      this.logger.info('未登录用户断开WebSocket连接', { 
        socketId: socket.id,
        reason
      });
    }
    
    // 清理定时器
    if (socket.connectionTimeout) {
      clearTimeout(socket.connectionTimeout);
    }
  }

  // 处理错误
  handleError(socket, error) {
    this.logger.error('WebSocket连接错误', { 
      socketId: socket.id,
      userId: socket.userId,
      error: error.message,
      stack: error.stack
    });
    
    // 发送错误信息给客户端
    socket.emit('connection_error', {
      message: '连接出现错误',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }

  // 启动心跳检测
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.performHeartbeat();
    }, this.heartbeatInterval);
    
    this.logger.info('WebSocket心跳检测已启动', { 
      interval: this.heartbeatInterval 
    });
  }

  // 执行心跳检测
  performHeartbeat() {
    const now = Date.now();
    const timeoutThreshold = this.heartbeatInterval * 2; // 2倍心跳间隔作为超时阈值
    
    this.clients.forEach((sockets, userId) => {
      sockets.forEach((socket) => {
        const timeSinceLastPing = now - (socket.lastPing || 0);
        
        if (timeSinceLastPing > timeoutThreshold) {
          this.logger.warn('检测到无响应连接，断开连接', { 
            userId, 
            socketId: socket.id,
            timeSinceLastPing
          });
          
          socket.disconnect(true);
        } else {
          // 发送心跳包
          socket.emit('heartbeat', { 
            timestamp: now,
            serverTime: now
          });
        }
      });
    });
  }

  // 启动连接监控
  startConnectionMonitoring() {
    setInterval(() => {
      this.logConnectionStats();
    }, 60000); // 每分钟记录一次统计信息
  }

  // 记录连接统计信息
  logConnectionStats() {
    this.logger.info('WebSocket连接统计', {
      ...this.connectionStats,
      activeUsers: this.getConnectedUsersCount(),
      totalSockets: this.getTotalConnectionsCount()
    });
  }

  // 发送消息给指定用户
  sendToUser(userId, data) {
    if (!userId || !this.clients.has(userId)) {
      this.logger.debug('用户未连接WebSocket', { userId });
      return false;
    }
    
    const userSockets = this.clients.get(userId);
    let sentCount = 0;
    let failedCount = 0;
    
    userSockets.forEach((socket) => {
      try {
        if (socket.connected) {
          socket.emit('message', data);
          sentCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        this.logger.error('发送消息失败', { 
          userId, 
          socketId: socket.id, 
          error: error.message 
        });
        failedCount++;
      }
    });
    
    this.logger.debug('向用户发送WebSocket消息', { 
      userId, 
      dataType: data.type, 
      sentCount,
      failedCount
    });
    
    return sentCount > 0;
  }

  // 发送消息给所有用户
  broadcast(data) {
    try {
      this.io.emit('message', data);
      this.logger.debug('广播WebSocket消息', { 
        dataType: data.type,
        totalConnections: this.getTotalConnectionsCount()
      });
      return true;
    } catch (error) {
      this.logger.error('广播消息失败', { error: error.message });
      return false;
    }
  }

  // 获取当前连接的用户数
  getConnectedUsersCount() {
    return this.clients.size;
  }

  // 获取当前总连接数
  getTotalConnectionsCount() {
    let count = 0;
    this.clients.forEach((sockets) => {
      count += sockets.size;
    });
    return count;
  }

  // 获取用户连接状态
  isUserConnected(userId) {
    return this.clients.has(userId);
  }

  // 获取连接统计信息
  getConnectionStats() {
    return {
      ...this.connectionStats,
      activeUsers: this.getConnectedUsersCount(),
      totalSockets: this.getTotalConnectionsCount(),
      uptime: process.uptime()
    };
  }

  // 发送错误消息给用户
  sendErrorToUser(userId, errorMessage) {
    return this.sendToUser(userId, {
      type: 'error',
      data: { 
        message: errorMessage,
        timestamp: new Date().toISOString()
      }
    });
  }

  // 发送成功消息给用户
  sendSuccessToUser(userId, successMessage, data = {}) {
    return this.sendToUser(userId, {
      type: 'success',
      data: {
        message: successMessage,
        timestamp: new Date().toISOString(),
        ...data
      }
    });
  }

  // 清理资源
  cleanup() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    this.logger.info('WebSocket服务已清理');
  }
}

// 创建并导出单例实例
const enhancedWebSocketUtils = new EnhancedWebSocketUtils();
module.exports = enhancedWebSocketUtils;
