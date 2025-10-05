// 简化的API测试
const request = require('supertest');

// 创建一个简单的测试服务器
const express = require('express');
const app = express();

// 添加基本的中间件
app.use(express.json());

// 添加测试路由
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: '测试服务器运行正常',
    timestamp: new Date().toISOString()
  });
});

app.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    data: '测试数据',
    message: '测试接口正常工作'
  });
});

app.post('/test', (req, res) => {
  res.json({ 
    success: true, 
    received: req.body,
    message: 'POST请求处理成功'
  });
});

describe('基础API测试', () => {
  
  describe('健康检查接口', () => {
    test('GET /health 应该返回200状态码', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
  
  describe('测试接口', () => {
    test('GET /test 应该返回测试数据', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data', '测试数据');
      expect(response.body).toHaveProperty('message');
    });
    
    test('POST /test 应该处理POST请求', async () => {
      const testData = { message: '测试POST数据' };
      
      const response = await request(app)
        .post('/test')
        .send(testData)
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('received', testData);
      expect(response.body).toHaveProperty('message');
    });
  });
  
  describe('错误处理', () => {
    test('访问不存在的路由应该返回404', async () => {
      const response = await request(app)
        .get('/nonexistent')
        .expect(404);
    });
  });
});
