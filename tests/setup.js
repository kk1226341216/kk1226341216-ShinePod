// 测试环境设置
const path = require('path');

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.PORT = '3003';
process.env.MONGO_URI = 'mongodb://localhost:27017/shinepod_test';

// 设置测试超时
jest.setTimeout(30000);

// 全局测试工具
global.testUtils = {
  // 生成测试数据
  generateTestMessage: (overrides = {}) => ({
    wechat_msg_id: 'test_msg_' + Date.now(),
    user_id: 'test_user_001',
    content_type: 'text',
    raw_content: '测试消息内容',
    converted_text: '测试消息内容',
    created_at: new Date(),
    status: 'pending',
    ...overrides
  }),
  
  // 生成测试用户
  generateTestUser: (overrides = {}) => ({
    id: 'test_user_001',
    name: '测试用户',
    avatar: '测',
    ...overrides
  }),
  
  // 等待指定时间
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // 清理测试数据
  cleanup: async () => {
    // 这里可以添加清理逻辑
    console.log('🧹 清理测试数据');
  }
};

// 测试前设置
beforeAll(async () => {
  console.log('🚀 开始测试套件');
});

// 测试后清理
afterAll(async () => {
  console.log('✅ 测试套件完成');
  await global.testUtils.cleanup();
});

// 每个测试前
beforeEach(() => {
  console.log('📝 开始新测试');
});

// 每个测试后
afterEach(() => {
  console.log('✅ 测试完成');
});
