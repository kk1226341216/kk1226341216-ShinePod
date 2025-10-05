// 自定义错误类
class AppError extends Error {
  constructor(statusCode, message, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// 处理404错误
const handleNotFound = (req, res, next) => {
  next(new AppError(404, `无法找到 ${req.originalUrl} 这个路由`));
};

// 开发环境错误处理
const devErrorHandler = (err, req, res) => {
  console.error('开发环境错误:', err);
  
  if (req.originalUrl.startsWith('/api')) {
    // API错误
    return res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack
    });
  }
  
  // 渲染错误页面
  return res.status(err.statusCode).render('error', {
    title: '错误',
    msg: err.message
  });
};

// 生产环境错误处理
const prodErrorHandler = (err, req, res) => {
  console.error('生产环境错误:', err);
  
  if (req.originalUrl.startsWith('/api')) {
    // API错误
    // 可操作的错误，发送详细信息
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: err.status,
        message: err.message
      });
    }
    
    // 不可操作的错误，不泄露详细信息
    // 1. 记录错误日志
    console.error('FATAL ERROR:', err);
    
    // 2. 发送通用错误信息
    return res.status(500).json({
      status: 'error',
      message: '服务器发生了一些问题，请稍后再试'
    });
  }
  
  // 渲染错误页面
  if (err.isOperational) {
    return res.status(err.statusCode).render('error', {
      title: '错误',
      msg: err.message
    });
  }
  
  // 不可操作的错误
  return res.status(err.statusCode).render('error', {
    title: '错误',
    msg: '服务器发生了一些问题，请稍后再试'
  });
};

// 全局错误处理中间件
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  
  if (process.env.NODE_ENV === 'development') {
    devErrorHandler(err, req, res);
  } else if (process.env.NODE_ENV === 'production') {
    // 处理不同类型的错误
    let error = { ...err };
    error.message = err.message;
    
    // MongoDB错误处理
    if (err.name === 'CastError') error = handleCastErrorDB(error);
    if (err.code === 11000) error = handleDuplicateFieldsDB(error);
    if (err.name === 'ValidationError') error = handleValidationErrorDB(error);
    
    prodErrorHandler(error, req, res);
  }
};

// 处理MongoDB类型转换错误
const handleCastErrorDB = (err) => {
  const message = `无效的 ${err.path}: ${err.value}`;
  return new AppError(400, message);
};

// 处理MongoDB重复字段错误
const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg.match(/(["'])(?:(?=(\\?))\2.)*?\1/)[0];
  const message = `该字段值已存在: ${value}。请使用其他值。`;
  return new AppError(400, message);
};

// 处理MongoDB验证错误
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `输入数据无效: ${errors.join('. ')}`;
  return new AppError(400, message);
};

// 异步处理包装器
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

// 导出所有类和函数
module.exports = {
  AppError,
  handleNotFound,
  devErrorHandler,
  prodErrorHandler,
  globalErrorHandler,
  handleCastErrorDB,
  handleDuplicateFieldsDB,
  handleValidationErrorDB,
  catchAsync
};