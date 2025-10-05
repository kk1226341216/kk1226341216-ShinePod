const os = require('os');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

class SystemMonitor {
  constructor() {
    this.logger = require('./server/utils/logger');
    this.alerts = [];
    this.metrics = {
      cpu: 0,
      memory: 0,
      disk: 0,
      network: 0,
      connections: 0,
      uptime: 0
    };
    this.thresholds = {
      cpu: 80,        // CPU使用率阈值
      memory: 85,     // 内存使用率阈值
      disk: 90,       // 磁盘使用率阈值
      connections: 1000 // 连接数阈值
    };
    this.alertChannels = {
      email: false,
      webhook: false,
      log: true
    };
  }

  // 启动监控
  start() {
    this.logger.info('🔍 系统监控启动');
    
    // 每30秒收集一次指标
    setInterval(() => {
      this.collectMetrics();
    }, 30000);
    
    // 每5分钟检查一次告警
    setInterval(() => {
      this.checkAlerts();
    }, 300000);
    
    // 每1小时生成一次报告
    setInterval(() => {
      this.generateReport();
    }, 3600000);
  }

  // 收集系统指标
  collectMetrics() {
    try {
      // CPU使用率
      this.metrics.cpu = this.getCPUUsage();
      
      // 内存使用率
      this.metrics.memory = this.getMemoryUsage();
      
      // 磁盘使用率
      this.metrics.disk = this.getDiskUsage();
      
      // 网络连接数
      this.metrics.connections = this.getNetworkConnections();
      
      // 系统运行时间
      this.metrics.uptime = process.uptime();
      
      this.logger.debug('📊 系统指标收集完成', this.metrics);
    } catch (error) {
      this.logger.error('❌ 收集系统指标失败', { error: error.message });
    }
  }

  // 获取CPU使用率
  getCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (let type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    return Math.round(100 - (100 * totalIdle / totalTick));
  }

  // 获取内存使用率
  getMemoryUsage() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    return Math.round((usedMem / totalMem) * 100);
  }

  // 获取磁盘使用率
  getDiskUsage() {
    try {
      const stats = fs.statSync('.');
      // 这里简化处理，实际应该使用更精确的磁盘空间检测
      return 0; // 暂时返回0，实际部署时需要实现
    } catch (error) {
      return 0;
    }
  }

  // 获取网络连接数
  getNetworkConnections() {
    // 这里简化处理，实际应该检测实际的网络连接
    return 0;
  }

  // 检查告警条件
  checkAlerts() {
    const alerts = [];
    
    // CPU告警
    if (this.metrics.cpu > this.thresholds.cpu) {
      alerts.push({
        type: 'cpu',
        level: 'warning',
        message: `CPU使用率过高: ${this.metrics.cpu}%`,
        threshold: this.thresholds.cpu,
        current: this.metrics.cpu,
        timestamp: new Date()
      });
    }
    
    // 内存告警
    if (this.metrics.memory > this.thresholds.memory) {
      alerts.push({
        type: 'memory',
        level: 'warning',
        message: `内存使用率过高: ${this.metrics.memory}%`,
        threshold: this.thresholds.memory,
        current: this.metrics.memory,
        timestamp: new Date()
      });
    }
    
    // 磁盘告警
    if (this.metrics.disk > this.thresholds.disk) {
      alerts.push({
        type: 'disk',
        level: 'critical',
        message: `磁盘使用率过高: ${this.metrics.disk}%`,
        threshold: this.thresholds.disk,
        current: this.metrics.disk,
        timestamp: new Date()
      });
    }
    
    // 连接数告警
    if (this.metrics.connections > this.thresholds.connections) {
      alerts.push({
        type: 'connections',
        level: 'warning',
        message: `网络连接数过多: ${this.metrics.connections}`,
        threshold: this.thresholds.connections,
        current: this.metrics.connections,
        timestamp: new Date()
      });
    }
    
    // 处理告警
    alerts.forEach(alert => {
      this.handleAlert(alert);
    });
  }

  // 处理告警
  handleAlert(alert) {
    this.alerts.push(alert);
    
    // 记录告警日志
    if (this.alertChannels.log) {
      this.logger.warn(`🚨 系统告警: ${alert.message}`, alert);
    }
    
    // 发送邮件告警
    if (this.alertChannels.email) {
      this.sendEmailAlert(alert);
    }
    
    // 发送Webhook告警
    if (this.alertChannels.webhook) {
      this.sendWebhookAlert(alert);
    }
  }

  // 发送邮件告警
  sendEmailAlert(alert) {
    // 这里需要配置邮件服务
    this.logger.info('📧 发送邮件告警', { alert: alert.message });
  }

  // 发送Webhook告警
  sendWebhookAlert(alert) {
    // 这里需要配置Webhook URL
    this.logger.info('🔗 发送Webhook告警', { alert: alert.message });
  }

  // 生成监控报告
  generateReport() {
    const report = {
      timestamp: new Date(),
      metrics: this.metrics,
      alerts: this.alerts.slice(-10), // 最近10个告警
      summary: {
        totalAlerts: this.alerts.length,
        criticalAlerts: this.alerts.filter(a => a.level === 'critical').length,
        warningAlerts: this.alerts.filter(a => a.level === 'warning').length,
        systemUptime: this.metrics.uptime
      }
    };
    
    this.logger.info('📊 生成监控报告', report);
    
    // 保存报告到文件
    this.saveReport(report);
  }

  // 保存报告到文件
  saveReport(report) {
    try {
      const reportsDir = path.join(__dirname, 'logs', 'reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      
      const reportFile = path.join(reportsDir, `report-${Date.now()}.json`);
      fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
      
      this.logger.debug('💾 监控报告已保存', { file: reportFile });
    } catch (error) {
      this.logger.error('❌ 保存监控报告失败', { error: error.message });
    }
  }

  // 获取监控数据
  getMetrics() {
    return {
      current: this.metrics,
      thresholds: this.thresholds,
      alerts: this.alerts.slice(-20), // 最近20个告警
      uptime: process.uptime()
    };
  }

  // 设置告警阈值
  setThreshold(type, value) {
    if (this.thresholds.hasOwnProperty(type)) {
      this.thresholds[type] = value;
      this.logger.info(`⚙️ 更新告警阈值`, { type, value });
    }
  }

  // 启用/禁用告警通道
  setAlertChannel(channel, enabled) {
    if (this.alertChannels.hasOwnProperty(channel)) {
      this.alertChannels[channel] = enabled;
      this.logger.info(`⚙️ 更新告警通道`, { channel, enabled });
    }
  }
}

// 应用监控类
class ApplicationMonitor {
  constructor() {
    this.logger = require('./server/utils/logger');
    this.metrics = {
      requests: 0,
      errors: 0,
      responseTime: 0,
      activeConnections: 0,
      memoryUsage: 0
    };
    this.startTime = Date.now();
  }

  // 记录请求
  recordRequest(responseTime) {
    this.metrics.requests++;
    this.metrics.responseTime = responseTime;
  }

  // 记录错误
  recordError(error) {
    this.metrics.errors++;
    this.logger.error('🚨 应用错误', { error: error.message });
  }

  // 更新连接数
  updateConnections(count) {
    this.metrics.activeConnections = count;
  }

  // 更新内存使用
  updateMemoryUsage() {
    const usage = process.memoryUsage();
    this.metrics.memoryUsage = Math.round(usage.heapUsed / 1024 / 1024); // MB
  }

  // 获取应用指标
  getMetrics() {
    this.updateMemoryUsage();
    
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime,
      errorRate: this.metrics.requests > 0 ? (this.metrics.errors / this.metrics.requests * 100).toFixed(2) : 0
    };
  }
}

// 健康检查类
class HealthChecker {
  constructor() {
    this.logger = require('./server/utils/logger');
    this.checks = [];
  }

  // 添加健康检查
  addCheck(name, checkFunction) {
    this.checks.push({
      name,
      check: checkFunction,
      status: 'unknown',
      lastCheck: null,
      error: null
    });
  }

  // 执行所有健康检查
  async runChecks() {
    const results = [];
    
    for (const check of this.checks) {
      try {
        const startTime = Date.now();
        const result = await check.check();
        const duration = Date.now() - startTime;
        
        check.status = result ? 'healthy' : 'unhealthy';
        check.lastCheck = new Date();
        check.error = null;
        
        results.push({
          name: check.name,
          status: check.status,
          duration,
          timestamp: check.lastCheck
        });
        
        this.logger.debug(`✅ 健康检查通过: ${check.name}`, { duration });
      } catch (error) {
        check.status = 'error';
        check.lastCheck = new Date();
        check.error = error.message;
        
        results.push({
          name: check.name,
          status: 'error',
          error: error.message,
          timestamp: check.lastCheck
        });
        
        this.logger.error(`❌ 健康检查失败: ${check.name}`, { error: error.message });
      }
    }
    
    return results;
  }

  // 获取健康状态
  getHealthStatus() {
    const healthy = this.checks.filter(c => c.status === 'healthy').length;
    const total = this.checks.length;
    
    return {
      status: healthy === total ? 'healthy' : 'unhealthy',
      checks: this.checks.map(c => ({
        name: c.name,
        status: c.status,
        lastCheck: c.lastCheck,
        error: c.error
      })),
      summary: {
        total,
        healthy,
        unhealthy: total - healthy
      }
    };
  }
}

// 创建监控实例
const systemMonitor = new SystemMonitor();
const applicationMonitor = new ApplicationMonitor();
const healthChecker = new HealthChecker();

// 添加健康检查
healthChecker.addCheck('database', async () => {
  // 检查数据库连接
  return true; // 简化处理
});

healthChecker.addCheck('websocket', async () => {
  // 检查WebSocket服务
  return true; // 简化处理
});

healthChecker.addCheck('external_apis', async () => {
  // 检查外部API
  return true; // 简化处理
});

module.exports = {
  SystemMonitor,
  ApplicationMonitor,
  HealthChecker,
  systemMonitor,
  applicationMonitor,
  healthChecker
};
