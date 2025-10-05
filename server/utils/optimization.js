const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const fs = require('fs');
const path = require('path');

class SecurityManager {
  constructor() {
    this.logger = require('./logger');
    this.blockedIPs = new Set();
    this.suspiciousActivities = new Map();
    this.securityConfig = {
      maxLoginAttempts: 5,
      lockoutDuration: 15 * 60 * 1000, // 15分钟
      suspiciousThreshold: 10,
      blockDuration: 60 * 60 * 1000 // 1小时
    };
  }

  // 创建安全中间件
  createSecurityMiddleware() {
    return [
      // 基础安全头
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
          }
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true
        },
        noSniff: true,
        xssFilter: true,
        referrerPolicy: { policy: "strict-origin-when-cross-origin" }
      }),

      // 请求频率限制
      rateLimit({
        windowMs: 15 * 60 * 1000, // 15分钟
        max: 100, // 限制每个IP 15分钟内最多100个请求
        message: {
          error: '请求过于频繁，请稍后再试',
          retryAfter: '15分钟'
        },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
          this.logger.warn('🚨 请求频率超限', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path
          });
          res.status(429).json({
            error: '请求过于频繁，请稍后再试',
            retryAfter: '15分钟'
          });
        }
      }),

      // 压缩响应
      compression({
        level: 6,
        threshold: 1024,
        filter: (req, res) => {
          if (req.headers['x-no-compression']) {
            return false;
          }
          return compression.filter(req, res);
        }
      }),

      // IP黑名单检查
      this.ipBlacklistMiddleware(),

      // 请求日志
      this.requestLoggingMiddleware()
    ];
  }

  // IP黑名单中间件
  ipBlacklistMiddleware() {
    return (req, res, next) => {
      const clientIP = req.ip || req.connection.remoteAddress;
      
      if (this.blockedIPs.has(clientIP)) {
        this.logger.warn('🚫 阻止黑名单IP访问', { ip: clientIP });
        return res.status(403).json({
          error: '访问被拒绝',
          reason: 'IP地址已被封禁'
        });
      }
      
      next();
    };
  }

  // 请求日志中间件
  requestLoggingMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logData = {
          method: req.method,
          url: req.url,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          statusCode: res.statusCode,
          duration: duration,
          timestamp: new Date().toISOString()
        };
        
        if (res.statusCode >= 400) {
          this.logger.warn('⚠️ HTTP错误请求', logData);
        } else {
          this.logger.debug('📝 HTTP请求', logData);
        }
      });
      
      next();
    };
  }

  // 记录可疑活动
  recordSuspiciousActivity(ip, activity) {
    if (!this.suspiciousActivities.has(ip)) {
      this.suspiciousActivities.set(ip, []);
    }
    
    const activities = this.suspiciousActivities.get(ip);
    activities.push({
      activity,
      timestamp: new Date(),
      count: activities.length + 1
    });
    
    // 如果可疑活动超过阈值，封禁IP
    if (activities.length >= this.securityConfig.suspiciousThreshold) {
      this.blockIP(ip, '可疑活动过多');
    }
    
    this.logger.warn('🚨 记录可疑活动', { ip, activity });
  }

  // 封禁IP
  blockIP(ip, reason) {
    this.blockedIPs.add(ip);
    this.logger.warn('🚫 封禁IP地址', { ip, reason });
    
    // 设置自动解封
    setTimeout(() => {
      this.unblockIP(ip);
    }, this.securityConfig.blockDuration);
  }

  // 解封IP
  unblockIP(ip) {
    this.blockedIPs.delete(ip);
    this.suspiciousActivities.delete(ip);
    this.logger.info('✅ 解封IP地址', { ip });
  }

  // 验证请求签名
  validateSignature(data, signature, secret) {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  // 生成安全令牌
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // 加密敏感数据
  encryptData(data, key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', key);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  // 解密敏感数据
  decryptData(encryptedData, key) {
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

class PerformanceOptimizer {
  constructor() {
    this.logger = require('./logger');
    this.cache = new Map();
    this.cacheConfig = {
      maxSize: 1000,
      ttl: 5 * 60 * 1000 // 5分钟
    };
    this.performanceMetrics = {
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      totalRequests: 0
    };
  }

  // 创建缓存中间件
  createCacheMiddleware(ttl = this.cacheConfig.ttl) {
    return (req, res, next) => {
      const cacheKey = this.generateCacheKey(req);
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < ttl) {
        this.performanceMetrics.cacheHits++;
        this.logger.debug('💾 缓存命中', { key: cacheKey });
        return res.json(cached.data);
      }
      
      // 拦截响应
      const originalSend = res.json;
      res.json = function(data) {
        // 只缓存GET请求的成功响应
        if (req.method === 'GET' && res.statusCode === 200) {
          this.cache.set(cacheKey, {
            data,
            timestamp: Date.now()
          });
          this.performanceMetrics.cacheMisses++;
          this.logger.debug('💾 缓存存储', { key: cacheKey });
        }
        
        originalSend.call(this, data);
      }.bind(this);
      
      next();
    };
  }

  // 生成缓存键
  generateCacheKey(req) {
    const key = `${req.method}:${req.url}:${JSON.stringify(req.query)}`;
    return crypto.createHash('md5').update(key).digest('hex');
  }

  // 清理过期缓存
  cleanExpiredCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheConfig.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.debug('🧹 清理过期缓存', { cleaned });
    }
  }

  // 优化数据库查询
  optimizeDatabaseQuery(query, options = {}) {
    const optimizedQuery = { ...query };
    
    // 添加索引提示
    if (options.useIndex) {
      optimizedQuery.hint = options.useIndex;
    }
    
    // 限制返回字段
    if (options.fields) {
      optimizedQuery.projection = options.fields;
    }
    
    // 设置查询超时
    if (options.timeout) {
      optimizedQuery.maxTimeMS = options.timeout;
    }
    
    return optimizedQuery;
  }

  // 批量处理
  async batchProcess(items, processor, batchSize = 100) {
    const results = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(item => processor(item))
      );
      results.push(...batchResults);
      
      // 添加延迟避免过载
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    return results;
  }

  // 连接池优化
  optimizeConnectionPool(config) {
    return {
      ...config,
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferMaxEntries: 0,
      bufferCommands: false
    };
  }

  // 获取性能指标
  getPerformanceMetrics() {
    const cacheHitRate = this.performanceMetrics.cacheHits / 
      (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses) * 100;
    
    return {
      ...this.performanceMetrics,
      cacheHitRate: cacheHitRate.toFixed(2) + '%',
      cacheSize: this.cache.size,
      memoryUsage: process.memoryUsage()
    };
  }

  // 启动性能监控
  startPerformanceMonitoring() {
    // 定期清理缓存
    setInterval(() => {
      this.cleanExpiredCache();
    }, 60000); // 每分钟清理一次
    
    // 定期记录性能指标
    setInterval(() => {
      const metrics = this.getPerformanceMetrics();
      this.logger.info('📊 性能指标', metrics);
    }, 300000); // 每5分钟记录一次
  }
}

class ResourceManager {
  constructor() {
    this.logger = require('./logger');
    this.resourceLimits = {
      maxMemoryUsage: 512 * 1024 * 1024, // 512MB
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxConcurrentRequests: 1000
    };
    this.currentLoad = {
      memoryUsage: 0,
      activeRequests: 0,
      fileHandles: 0
    };
  }

  // 检查资源限制
  checkResourceLimits() {
    const memoryUsage = process.memoryUsage();
    const isMemoryLimitExceeded = memoryUsage.heapUsed > this.resourceLimits.maxMemoryUsage;
    
    if (isMemoryLimitExceeded) {
      this.logger.warn('⚠️ 内存使用超限', {
        current: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
        limit: Math.round(this.resourceLimits.maxMemoryUsage / 1024 / 1024) + 'MB'
      });
      
      // 触发垃圾回收
      if (global.gc) {
        global.gc();
        this.logger.info('🗑️ 触发垃圾回收');
      }
    }
    
    return {
      memoryLimitExceeded: isMemoryLimitExceeded,
      memoryUsage: memoryUsage.heapUsed,
      activeRequests: this.currentLoad.activeRequests
    };
  }

  // 文件大小检查中间件
  fileSizeLimitMiddleware() {
    return (req, res, next) => {
      const contentLength = parseInt(req.get('content-length') || '0');
      
      if (contentLength > this.resourceLimits.maxFileSize) {
        this.logger.warn('⚠️ 文件大小超限', {
          size: Math.round(contentLength / 1024 / 1024) + 'MB',
          limit: Math.round(this.resourceLimits.maxFileSize / 1024 / 1024) + 'MB'
        });
        
        return res.status(413).json({
          error: '文件大小超限',
          maxSize: this.resourceLimits.maxFileSize
        });
      }
      
      next();
    };
  }

  // 并发请求限制中间件
  concurrencyLimitMiddleware() {
    return (req, res, next) => {
      this.currentLoad.activeRequests++;
      
      if (this.currentLoad.activeRequests > this.resourceLimits.maxConcurrentRequests) {
        this.currentLoad.activeRequests--;
        this.logger.warn('⚠️ 并发请求超限', {
          current: this.currentLoad.activeRequests,
          limit: this.resourceLimits.maxConcurrentRequests
        });
        
        return res.status(503).json({
          error: '服务器繁忙，请稍后再试'
        });
      }
      
      res.on('finish', () => {
        this.currentLoad.activeRequests--;
      });
      
      next();
    };
  }
}

// 创建实例
const securityManager = new SecurityManager();
const performanceOptimizer = new PerformanceOptimizer();
const resourceManager = new ResourceManager();

// 启动性能监控
performanceOptimizer.startPerformanceMonitoring();

module.exports = {
  SecurityManager,
  PerformanceOptimizer,
  ResourceManager,
  securityManager,
  performanceOptimizer,
  resourceManager
};
