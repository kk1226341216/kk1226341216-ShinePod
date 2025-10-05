const winston = require('winston');
const { logConfig } = require('../config/config');
const fs = require('fs');
const path = require('path');

// 确保日志目录存在
const logDir = path.dirname(logConfig.file);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 创建日志格式化器
const logFormat = winston.format.printf(({ timestamp, level, message, metadata }) => {
  // 处理错误对象
  let logMessage = message;
  if (message instanceof Error) {
    logMessage = `${message.message}\n${message.stack}`;
  }
  
  // 添加元数据
  let metadataStr = '';
  if (metadata && Object.keys(metadata).length > 0) {
    metadataStr = ` ${JSON.stringify(metadata)}`;
  }
  
  return `[${timestamp}] ${level.toUpperCase()}: ${logMessage}${metadataStr}`;
});

// 创建主日志器
const logger = winston.createLogger({
  level: logConfig.level,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    logFormat
  ),
  defaultMeta: { service: 'shinepod-wechat-service' },
  transports: [
    // 错误日志文件
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true,
      zippedArchive: true
    }),
    // 所有日志文件
    new winston.transports.File({
      filename: logConfig.file,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true,
      zippedArchive: true
    })
  ]
});

// 在开发环境中，同时输出到控制台
if (process.env.NODE_ENV === 'development') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
      winston.format.printf(({ timestamp, level, message }) => {
        return `[${timestamp}] ${level}: ${message}`;
      })
    )
  }));
}

// 创建HTTP请求日志器
const httpLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'http.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true,
      zippedArchive: true
    })
  ]
});

// 创建数据库日志器
const dbLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    logFormat
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'db.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true,
      zippedArchive: true
    })
  ]
});

// 创建微信消息日志器
const wechatLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    logFormat
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'wechat.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true,
      zippedArchive: true
    })
  ]
});

// Express中间件：HTTP请求日志
const expressLoggerMiddleware = (req, res, next) => {
  const start = Date.now();
  const { method, url, headers, body } = req;
  const userAgent = headers['user-agent'];
  const ip = req.ip || req.connection.remoteAddress;
  
  // 忽略健康检查和静态资源请求
  if (url === '/health' || url.startsWith('/static/')) {
    return next();
  }
  
  // 记录请求信息
  const requestInfo = {
    method,
    url,
    ip,
    userAgent
  };
  
  // 记录请求体（只记录非敏感信息）
  if (method !== 'GET' && body && Object.keys(body).length > 0) {
    // 排除敏感信息
    const safeBody = { ...body };
    if (safeBody.password) safeBody.password = '******';
    if (safeBody.secret) safeBody.secret = '******';
    
    requestInfo.body = safeBody;
  }
  
  // 监听响应完成事件
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    
    // 构建日志消息
    const logMessage = `${method} ${url} ${statusCode} ${duration}ms - ${ip}`;
    
    // 根据状态码选择日志级别
    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    
    // 记录日志
    httpLogger.log(logLevel, logMessage);
    
    // 控制台输出
    if (process.env.NODE_ENV === 'development') {
      const color = statusCode >= 500 ? '\x1b[31m' : statusCode >= 400 ? '\x1b[33m' : '\x1b[32m';
      console.log(`${color}${logMessage}\x1b[0m`);
    }
  });
  
  next();
};

// 日志工具函数
const logUtils = {
  // 记录普通信息
  info: (message, metadata = {}) => {
    logger.info(message, { metadata });
  },
  
  // 记录警告信息
  warn: (message, metadata = {}) => {
    logger.warn(message, { metadata });
  },
  
  // 记录错误信息
  error: (message, metadata = {}) => {
    logger.error(message, { metadata });
  },
  
  // 记录调试信息
  debug: (message, metadata = {}) => {
    logger.debug(message, { metadata });
  },
  
  // 记录微信相关信息
  wechat: {
    info: (message, metadata = {}) => {
      wechatLogger.info(message, { metadata });
    },
    warn: (message, metadata = {}) => {
      wechatLogger.warn(message, { metadata });
    },
    error: (message, metadata = {}) => {
      wechatLogger.error(message, { metadata });
    },
    debug: (message, metadata = {}) => {
      wechatLogger.debug(message, { metadata });
    }
  },
  
  // 记录数据库相关信息
  db: {
    info: (message, metadata = {}) => {
      dbLogger.info(message, { metadata });
    },
    warn: (message, metadata = {}) => {
      dbLogger.warn(message, { metadata });
    },
    error: (message, metadata = {}) => {
      dbLogger.error(message, { metadata });
    },
    debug: (message, metadata = {}) => {
      dbLogger.debug(message, { metadata });
    }
  },
  
  // Express中间件
  expressLogger: expressLoggerMiddleware,
  
  // 记录错误堆栈
  logError: (error, context = {}) => {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      context: context
    };
    
    logger.error(error.message, { metadata: errorInfo });
  }
};

module.exports = logUtils;