const mongoose = require('mongoose');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 数据库初始化脚本
class DatabaseInitializer {
  constructor() {
    this.mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/shinepod';
  }

  // 连接数据库
  async connect() {
    try {
      console.log('🔌 正在连接MongoDB...');
      
      await mongoose.connect(this.mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useCreateIndex: true,
        useFindAndModify: false
      });

      console.log('✅ MongoDB连接成功');
      return true;
    } catch (error) {
      console.error('❌ MongoDB连接失败:', error.message);
      return false;
    }
  }

  // 创建数据库索引
  async createIndexes() {
    try {
      console.log('📊 正在创建数据库索引...');

      // 引入模型以触发索引创建
      const WechatMessage = require('./server/models/wechatMessageModel');
      
      // 确保索引已创建
      await WechatMessage.ensureIndexes();
      
      console.log('✅ 数据库索引创建完成');
      return true;
    } catch (error) {
      console.error('❌ 创建索引失败:', error.message);
      return false;
    }
  }

  // 创建示例数据
  async createSampleData() {
    try {
      console.log('📝 正在创建示例数据...');

      const WechatMessage = require('./server/models/wechatMessageModel');
      
      // 检查是否已有数据
      const existingCount = await WechatMessage.countDocuments();
      if (existingCount > 0) {
        console.log(`ℹ️  数据库中已有 ${existingCount} 条记录，跳过示例数据创建`);
        return true;
      }

      // 创建示例消息
      const sampleMessages = [
        {
          wechat_msg_id: 'sample_msg_001',
          user_id: 'sample_user_001',
          content_type: 'text',
          raw_content: '这是一条示例文本消息',
          converted_text: '这是一条示例文本消息',
          status: 'synced',
          created_at: new Date()
        },
        {
          wechat_msg_id: 'sample_msg_002', 
          user_id: 'sample_user_001',
          content_type: 'voice',
          raw_content: 'sample_voice_media_id',
          converted_text: '这是一条示例语音消息的识别结果',
          status: 'synced',
          created_at: new Date()
        }
      ];

      await WechatMessage.insertMany(sampleMessages);
      console.log('✅ 示例数据创建完成');
      return true;
    } catch (error) {
      console.error('❌ 创建示例数据失败:', error.message);
      return false;
    }
  }

  // 检查数据库状态
  async checkDatabaseStatus() {
    try {
      console.log('🔍 检查数据库状态...');

      const WechatMessage = require('./server/models/wechatMessageModel');
      
      // 获取集合统计信息
      const stats = await mongoose.connection.db.stats();
      const messageCount = await WechatMessage.countDocuments();
      
      console.log('📊 数据库统计信息:');
      console.log(`   - 数据库名称: ${stats.db}`);
      console.log(`   - 集合数量: ${stats.collections}`);
      console.log(`   - 数据大小: ${(stats.dataSize / 1024).toFixed(2)} KB`);
      console.log(`   - 索引大小: ${(stats.indexSize / 1024).toFixed(2)} KB`);
      console.log(`   - 微信消息数量: ${messageCount}`);

      return true;
    } catch (error) {
      console.error('❌ 检查数据库状态失败:', error.message);
      return false;
    }
  }

  // 运行完整初始化
  async initialize() {
    console.log('🚀 开始数据库初始化...\n');

    const connected = await this.connect();
    if (!connected) {
      console.log('\n💡 请确保MongoDB服务正在运行');
      console.log('   启动命令: mongod --dbpath /usr/local/var/mongodb');
      console.log('   或使用: brew services start mongodb-community');
      return false;
    }

    const indexesCreated = await this.createIndexes();
    if (!indexesCreated) {
      return false;
    }

    const sampleDataCreated = await this.createSampleData();
    if (!sampleDataCreated) {
      return false;
    }

    const statusChecked = await this.checkDatabaseStatus();
    if (!statusChecked) {
      return false;
    }

    console.log('\n🎉 数据库初始化完成！');
    return true;
  }

  // 关闭连接
  async close() {
    try {
      await mongoose.connection.close();
      console.log('🔌 数据库连接已关闭');
    } catch (error) {
      console.error('❌ 关闭数据库连接失败:', error.message);
    }
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const initializer = new DatabaseInitializer();
  
  initializer.initialize()
    .then(success => {
      if (success) {
        console.log('\n✅ 数据库初始化成功！');
        console.log('🚀 现在可以启动应用服务器了');
      } else {
        console.log('\n❌ 数据库初始化失败');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 初始化过程中发生错误:', error.message);
      process.exit(1);
    })
    .finally(() => {
      initializer.close();
    });
}

module.exports = DatabaseInitializer;
