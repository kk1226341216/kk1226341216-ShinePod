const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');

// 加载环境变量
dotenv.config();

// 引入配置文件
const { serverConfig, dbConfig, logConfig } = require('./config/config');

// 引入日志工具
const logger = require('./utils/logger');

// 初始化Express应用
const app = express();
const server = http.createServer(app);

// 引入WebSocket工具
const webSocketUtils = require('./utils/webSocketUtils');

// 初始化Socket.io服务器
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// 初始化WebSocket工具
global.webSocketUtils = webSocketUtils;
webSocketUtils.init(io);

// 配置安全中间件
if (process.env.NODE_ENV === 'production') {
  app.use(helmet()); // 添加安全头
}

// 配置CORS
app.use(cors());

// 配置gzip压缩
if (process.env.PRODUCTION_GZIP === 'true') {
  app.use(compression());
}

// 配置请求超时
app.use((req, res, next) => {
  res.setTimeout(parseInt(process.env.API_TIMEOUT) || 30000, () => {
    res.status(504).json({ error: '请求超时' });
  });
  next();
});

// 配置HTTP请求日志中间件
app.use(logger.expressLogger);

// 配置中间件
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// 连接数据库
mongoose.connect(dbConfig.uri, dbConfig.options).then(() => {
  logger.info('MongoDB数据库连接成功');
  
  // 监听数据库连接事件
  mongoose.connection.on('connected', () => {
    logger.info('MongoDB数据库已连接');
  });
  
  mongoose.connection.on('error', (error) => {
    logger.error(`MongoDB数据库连接错误: ${error.message}`);
  });
  
  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB数据库连接断开');
  });
  
  // 进程终止时关闭数据库连接
  process.on('SIGINT', () => {
    mongoose.connection.close(() => {
      logger.info('MongoDB数据库连接已关闭');
      process.exit(0);
    });
  });
}).catch((err) => {
  logger.error(`MongoDB数据库连接失败: ${err.message}`);
  process.exit(1);
});

// 引入路由
const wechatRoutes = require('./routes/wechatRoutes');
const taskRoutes = require('./routes/taskRoutes');

// 注册路由
app.use('/wechat', wechatRoutes);
app.use('/tasks', taskRoutes);

// 引入错误处理工具
const { handleNotFound, globalErrorHandler } = require('./utils/errorHandler');

// 处理404错误
app.use(handleNotFound);

// 全局错误处理中间件
app.use(globalErrorHandler);

// 健康检查接口
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: '服务运行正常' });
});

// 启动服务器
server.listen(serverConfig.port, serverConfig.host, () => {
  logger.info(`服务器运行在 ${serverConfig.host}:${serverConfig.port}，环境: ${serverConfig.env}`);
  
  // 输出WebSocket服务器信息
  logger.info(`WebSocket服务器已启动，等待连接...`);
  
  // 输出服务健康状态
  logger.info(`服务启动成功，健康检查地址: http://${serverConfig.host}:${serverConfig.port}/health`);
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  logger.error(`未捕获的异常: ${error.message}`, { metadata: { stack: error.stack } });
  
  // 在开发环境中，可以选择继续运行
  if (process.env.NODE_ENV === 'development') {
    console.error(error);
  } else {
    // 在生产环境中，应该优雅地退出
    process.exit(1);
  }
});

// 处理未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`未处理的Promise拒绝: ${reason}`, { metadata: { promise } });
});

// 导出app供测试使用
module.exports = app;