const io = require('socket.io-client');

describe('WebSocket连接测试', () => {
  let client;
  
  beforeEach(() => {
    // 创建WebSocket客户端连接
    client = io('http://localhost:3000');
  });
  
  afterEach(() => {
    // 断开连接
    if (client) {
      client.disconnect();
    }
  });
  
  test('应该能够连接到WebSocket服务器', (done) => {
    client.on('connect', () => {
      expect(client.connected).toBe(true);
      done();
    });
    
    client.on('connect_error', (error) => {
      done(error);
    });
  });
  
  test('应该能够发送用户登录信息', (done) => {
    client.on('connect', () => {
      const loginData = {
        userId: 'test_user_001',
        userName: '测试用户'
      };
      
      client.emit('user_login', loginData);
      
      // 等待服务器响应
      setTimeout(() => {
        expect(client.connected).toBe(true);
        done();
      }, 1000);
    });
  });
  
  test('应该能够接收消息', (done) => {
    client.on('connect', () => {
      // 监听消息事件
      client.on('wechat_message', (data) => {
        expect(data).toHaveProperty('type');
        expect(data).toHaveProperty('data');
        done();
      });
      
      // 模拟发送消息
      setTimeout(() => {
        client.emit('test_message', {
          type: 'wechat_message',
          data: {
            _id: 'test_msg_001',
            user_id: 'test_user_001',
            content_type: 'text',
            raw_content: '测试消息',
            converted_text: '测试消息',
            status: 'pending'
          }
        });
      }, 500);
    });
  });
  
  test('应该能够处理心跳检测', (done) => {
    client.on('connect', () => {
      client.emit('ping');
      
      client.on('pong', (data) => {
        expect(data).toHaveProperty('timestamp');
        done();
      });
    });
  });
  
  test('应该能够处理断开连接', (done) => {
    client.on('connect', () => {
      client.disconnect();
      
      setTimeout(() => {
        expect(client.connected).toBe(false);
        done();
      }, 1000);
    });
  });
});
