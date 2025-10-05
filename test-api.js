const http = require('http');
const WebSocket = require('ws');

// API测试工具
class APITester {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.wsUrl = baseUrl.replace('http', 'ws');
  }

  // 测试健康检查接口
  async testHealthCheck() {
    try {
      console.log('🔍 测试健康检查接口...');
      
      const response = await this.makeRequest('/health');
      
      if (response.status === 200) {
        const data = JSON.parse(response.body);
        if (data.status === 'ok') {
          console.log('✅ 健康检查接口正常');
          return true;
        }
      }
      
      console.log('❌ 健康检查接口异常');
      return false;
    } catch (error) {
      console.log('❌ 健康检查接口测试失败:', error.message);
      return false;
    }
  }

  // 测试微信配置接口
  async testWechatConfig() {
    try {
      console.log('🔍 测试微信配置接口...');
      
      const response = await this.makeRequest('/wechat/config');
      
      if (response.status === 200) {
        const data = JSON.parse(response.body);
        console.log('✅ 微信配置接口正常');
        console.log('   配置信息:', data);
        return true;
      }
      
      console.log('❌ 微信配置接口异常');
      return false;
    } catch (error) {
      console.log('❌ 微信配置接口测试失败:', error.message);
      return false;
    }
  }

  // 测试任务接口
  async testTaskEndpoints() {
    try {
      console.log('🔍 测试任务相关接口...');
      
      // 测试获取任务列表
      const listResponse = await this.makeRequest('/tasks/wechat?userId=test_user&limit=10');
      
      if (listResponse.status === 200) {
        console.log('✅ 任务列表接口正常');
      } else {
        console.log('⚠️  任务列表接口返回状态:', listResponse.status);
      }

      // 测试搜索接口
      const searchResponse = await this.makeRequest('/tasks/wechat/search?userId=test_user&keyword=test');
      
      if (searchResponse.status === 200) {
        console.log('✅ 任务搜索接口正常');
      } else {
        console.log('⚠️  任务搜索接口返回状态:', searchResponse.status);
      }

      return true;
    } catch (error) {
      console.log('❌ 任务接口测试失败:', error.message);
      return false;
    }
  }

  // 测试WebSocket连接
  async testWebSocket() {
    return new Promise((resolve) => {
      try {
        console.log('🔍 测试WebSocket连接...');
        
        const ws = new WebSocket(this.wsUrl);
        let connected = false;
        let loginSuccess = false;

        const timeout = setTimeout(() => {
          if (!connected) {
            console.log('❌ WebSocket连接超时');
            ws.close();
            resolve(false);
          }
        }, 5000);

        ws.on('open', () => {
          connected = true;
          clearTimeout(timeout);
          console.log('✅ WebSocket连接成功');
          
          // 发送登录消息
          const loginMessage = {
            type: 'user_login',
            userId: 'test_user_001'
          };
          
          ws.send(JSON.stringify(loginMessage));
        });

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data);
            
            if (message.type === 'login_success') {
              loginSuccess = true;
              console.log('✅ WebSocket登录成功');
              ws.close();
              resolve(true);
            } else if (message.type === 'login_failed') {
              console.log('⚠️  WebSocket登录失败:', message.message);
              ws.close();
              resolve(false);
            }
          } catch (error) {
            console.log('❌ 解析WebSocket消息失败:', error.message);
            ws.close();
            resolve(false);
          }
        });

        ws.on('error', (error) => {
          console.log('❌ WebSocket连接错误:', error.message);
          clearTimeout(timeout);
          resolve(false);
        });

        ws.on('close', () => {
          if (connected && !loginSuccess) {
            console.log('⚠️  WebSocket连接已关闭');
            resolve(false);
          }
        });

      } catch (error) {
        console.log('❌ WebSocket测试失败:', error.message);
        resolve(false);
      }
    });
  }

  // 发送HTTP请求
  makeRequest(path) {
    return new Promise((resolve, reject) => {
      const url = `${this.baseUrl}${path}`;
      
      http.get(url, (res) => {
        let body = '';
        
        res.on('data', (chunk) => {
          body += chunk;
        });
        
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body
          });
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }

  // 运行所有测试
  async runAllTests() {
    console.log('🧪 开始API接口测试...\n');

    const results = {
      healthCheck: false,
      wechatConfig: false,
      taskEndpoints: false,
      webSocket: false
    };

    // 测试健康检查
    results.healthCheck = await this.testHealthCheck();
    console.log('');

    // 测试微信配置
    results.wechatConfig = await this.testWechatConfig();
    console.log('');

    // 测试任务接口
    results.taskEndpoints = await this.testTaskEndpoints();
    console.log('');

    // 测试WebSocket
    results.webSocket = await this.testWebSocket();
    console.log('');

    // 输出测试结果
    console.log('📊 测试结果汇总:');
    console.log('================');
    
    const testNames = {
      healthCheck: '健康检查接口',
      wechatConfig: '微信配置接口', 
      taskEndpoints: '任务相关接口',
      webSocket: 'WebSocket连接'
    };

    Object.keys(results).forEach(key => {
      const status = results[key] ? '✅' : '❌';
      console.log(`${status} ${testNames[key]}`);
    });

    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;

    console.log(`\n🎯 测试通过率: ${passedTests}/${totalTests}`);

    if (passedTests === totalTests) {
      console.log('🎉 所有测试通过！服务运行正常。');
    } else {
      console.log('⚠️  部分测试失败，请检查服务状态和配置。');
    }

    return results;
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const tester = new APITester();
  
  tester.runAllTests()
    .then(results => {
      const allPassed = Object.values(results).every(Boolean);
      process.exit(allPassed ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 测试过程中发生错误:', error.message);
      process.exit(1);
    });
}

module.exports = APITester;
