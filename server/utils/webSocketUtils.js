// WebSocket工具类
class WebSocketUtils {
  constructor() {
    this.clients = new Map(); // 存储客户端连接
    this.logger = require('./logger');
  }

  // 初始化WebSocket服务
  init(io) {
    this.io = io;
    
    // 监听连接事件
    io.on('connection', (socket) => {
      this.logger.info('新的WebSocket连接建立', { socketId: socket.id });
      
      // 监听用户登录事件
      socket.on('user_login', (userId) => {
        this.handleUserLogin(socket, userId);
      });
      
      // 监听断开连接事件
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
      
      // 监听心跳包
      socket.on('ping', () => {
        socket.emit('pong');
      });
    });
    
    this.logger.info('WebSocket服务初始化成功');
  }

  // 处理用户登录
  handleUserLogin(socket, userId) {
    if (!userId) {
      this.logger.warn('用户ID为空，无法建立连接', { socketId: socket.id });
      socket.emit('login_failed', { message: '用户ID不能为空' });
      return;
    }
    
    // 存储用户和socket的映射关系
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    
    this.clients.get(userId).add(socket);
    socket.userId = userId;
    
    this.logger.info('用户登录WebSocket成功', { userId, socketId: socket.id });
    socket.emit('login_success', { userId });
  }

  // 处理断开连接
  handleDisconnect(socket) {
    const { userId } = socket;
    
    if (userId && this.clients.has(userId)) {
      const userSockets = this.clients.get(userId);
      userSockets.delete(socket);
      
      // 如果用户没有其他连接，则从映射中删除
      if (userSockets.size === 0) {
        this.clients.delete(userId);
      }
      
      this.logger.info('用户断开WebSocket连接', { userId, socketId: socket.id });
    } else {
      this.logger.info('未登录用户断开WebSocket连接', { socketId: socket.id });
    }
  }

  // 发送消息给指定用户
  sendToUser(userId, data) {
    if (!userId || !this.clients.has(userId)) {
      this.logger.debug('用户未连接WebSocket', { userId });
      return false;
    }
    
    const userSockets = this.clients.get(userId);
    let sentCount = 0;
    
    userSockets.forEach((socket) => {
      try {
        socket.emit('message', data);
        sentCount++;
      } catch (error) {
        this.logger.error('发送消息失败', { userId, socketId: socket.id, error: error.message });
      }
    });
    
    this.logger.debug('向用户发送WebSocket消息', { userId, dataType: data.type, sentCount });
    return sentCount > 0;
  }

  // 发送消息给所有用户
  broadcast(data) {
    try {
      this.io.emit('message', data);
      this.logger.debug('广播WebSocket消息', { dataType: data.type });
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

  // 发送错误消息给用户
  sendErrorToUser(userId, errorMessage) {
    return this.sendToUser(userId, {
      type: 'error',
      data: { message: errorMessage }
    });
  }

  // 发送成功消息给用户
  sendSuccessToUser(userId, successMessage, data = {}) {
    return this.sendToUser(userId, {
      type: 'success',
      data: {
        message: successMessage,
        ...data
      }
    });
  }
}

// 创建并导出单例实例
const webSocketUtils = new WebSocketUtils();
module.exports = webSocketUtils;