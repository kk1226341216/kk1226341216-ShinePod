// 微信配置
const wechatConfig = {
  appid: process.env.WECHAT_APPID || 'YOUR_WECHAT_APPID',
  secret: process.env.WECHAT_SECRET || 'YOUR_WECHAT_SECRET',
  token: process.env.WECHAT_TOKEN || 'YOUR_WECHAT_TOKEN',
  encodingAESKey: process.env.WECHAT_ENCODING_AES_KEY || '',
  apiUrl: process.env.WECHAT_API_URL || 'https://api.weixin.qq.com',
  oauthUrl: process.env.WECHAT_OAUTH_URL || 'https://open.weixin.qq.com/connect/oauth2/authorize',
  templateMessageUrl: 'https://api.weixin.qq.com/cgi-bin/message/template/send',
  serverUrl: process.env.WECHAT_SERVER_URL || 'https://your-server.com'
};

// 数据库配置
const dbConfig = {
  uri: process.env.MONGO_URI || 'mongodb://localhost:27017/shinepod',
  options: {
    // 移除已废弃的选项
    // useNewUrlParser: true,  // 已废弃
    // useUnifiedTopology: true,  // 已废弃
    // useCreateIndex: true,  // 已废弃
    // useFindAndModify: false  // 已废弃
  }
};

// 服务器配置
const serverConfig = {
  port: process.env.PORT || 3000,
  host: process.env.HOST || '0.0.0.0',
  env: process.env.NODE_ENV || 'development'
};

// 百度AI配置
const baiduAIConfig = {
  appid: process.env.BAIDU_AI_APPID || 'YOUR_BAIDU_AI_APPID',
  apiKey: process.env.BAIDU_AI_API_KEY || 'YOUR_BAIDU_AI_API_KEY',
  secretKey: process.env.BAIDU_AI_SECRET_KEY || 'YOUR_BAIDU_AI_SECRET_KEY',
  asrUrl: 'https://vop.baidu.com/server_api',
  tokenUrl: 'https://aip.baidubce.com/oauth/2.0/token'
};

// 日志配置
const logConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: 'combined',
  file: process.env.LOG_FILE || './logs/app.log'
};

// 安全配置
const securityConfig = {
  jwtSecret: process.env.JWT_SECRET || 'YOUR_JWT_SECRET',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10
};

// API配置
const apiConfig = {
  prefix: process.env.API_PREFIX || '/api/v1',
  timeout: parseInt(process.env.API_TIMEOUT) || 30000
};

// 微信消息类型
const messageTypes = {
  TEXT: 'text',
  IMAGE: 'image',
  VOICE: 'voice',
  VIDEO: 'video',
  SHORT_VIDEO: 'shortvideo',
  LOCATION: 'location',
  LINK: 'link',
  EVENT: 'event'
};

// 微信事件类型
const eventTypes = {
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  SCAN: 'SCAN',
  LOCATION: 'LOCATION',
  CLICK: 'CLICK',
  VIEW: 'VIEW'
};

// 消息状态
const messageStatus = {
  PENDING: 'pending',
  SYNCED: 'synced',
  FAILED: 'failed'
};

// 消息内容类型
const contentType = {
  TEXT: 'text',
  IMAGE: 'image',
  VOICE: 'voice',
  VIDEO: 'video',
  LOCATION: 'location',
  LINK: 'link',
  EVENT: 'event'
};

// 导出配置
module.exports = {
  wechatConfig,
  dbConfig,
  serverConfig,
  baiduAIConfig,
  logConfig,
  securityConfig,
  apiConfig,
  messageTypes,
  eventTypes,
  messageStatus,
  contentType
};