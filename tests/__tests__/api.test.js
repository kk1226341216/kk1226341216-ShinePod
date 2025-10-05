const request = require('supertest');
const app = require('../../server-with-file-db');

describe('API接口测试', () => {
  
  describe('健康检查接口', () => {
    test('GET /health 应该返回200状态码', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('mode', 'file-database');
    });
  });
  
  describe('微信配置接口', () => {
    test('GET /wechat/config 应该返回配置信息', async () => {
      const response = await request(app)
        .get('/wechat/config')
        .expect(200);
      
      expect(response.body).toHaveProperty('appid');
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('mode', 'file-database');
    });
  });
  
  describe('任务接口', () => {
    test('GET /tasks/wechat 应该返回任务列表', async () => {
      const response = await request(app)
        .get('/tasks/wechat')
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('limit');
      expect(response.body).toHaveProperty('skip');
    });
    
    test('GET /tasks/wechat?userId=test_user 应该返回指定用户的任务', async () => {
      const response = await request(app)
        .get('/tasks/wechat?userId=test_user')
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });
    
    test('GET /tasks/wechat/search 应该返回搜索结果', async () => {
      const response = await request(app)
        .get('/tasks/wechat/search?keyword=test')
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
    });
  });
  
  describe('系统状态接口', () => {
    test('GET /api/status 应该返回系统状态', async () => {
      const response = await request(app)
        .get('/api/status')
        .expect(200);
      
      expect(response.body).toHaveProperty('service');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('mode', 'file-database');
      expect(response.body).toHaveProperty('status', 'running');
      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('features');
      expect(response.body).toHaveProperty('endpoints');
    });
  });
  
  describe('微信消息接口', () => {
    test('GET /wechat/message 应该处理微信验证请求', async () => {
      const response = await request(app)
        .get('/wechat/message?signature=test&timestamp=1234567890&nonce=test&echostr=test')
        .expect(200);
      
      expect(response.text).toBe('test');
    });
    
    test('POST /wechat/message 应该处理微信消息', async () => {
      const mockXml = `
        <xml>
          <FromUserName>test_user</FromUserName>
          <ToUserName>service</ToUserName>
          <CreateTime>1234567890</CreateTime>
          <MsgType>text</MsgType>
          <Content>测试消息</Content>
        </xml>
      `;
      
      const response = await request(app)
        .post('/wechat/message')
        .set('Content-Type', 'application/xml')
        .send(mockXml)
        .expect(200);
      
      expect(response.text).toContain('xml');
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
