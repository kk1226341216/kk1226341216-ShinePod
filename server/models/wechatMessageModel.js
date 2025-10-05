const mongoose = require('mongoose');

// 定义微信消息模型
const WechatMessageSchema = new mongoose.Schema({
  wechat_msg_id: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  user_id: {
    type: String,
    required: true,
    trim: true
  },
  content_type: {
    type: String,
    required: true,
    enum: ['voice', 'text'],
    trim: true
  },
  raw_content: {
    type: String,
    required: true,
    trim: true
  },
  converted_text: {
    type: String,
    trim: true
  },
  created_at: {
    type: Date,
    default: Date.now,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'synced', 'failed'],
    default: 'pending',
    trim: true
  }
});

// 创建索引以提高查询性能
WechatMessageSchema.index({ user_id: 1, created_at: -1 });
WechatMessageSchema.index({ status: 1 });

// 定义模型方法
WechatMessageSchema.statics.findByUserId = async function(userId, options = {}) {
  const { limit = 20, skip = 0 } = options;
  return this.find({ user_id: userId })
    .sort({ created_at: -1 })
    .limit(limit)
    .skip(skip);
};

WechatMessageSchema.statics.findPendingMessages = async function(options = {}) {
  const { limit = 100 } = options;
  return this.find({ status: 'pending' })
    .sort({ created_at: 1 })
    .limit(limit);
};

const WechatMessage = mongoose.model('WechatMessage', WechatMessageSchema);

module.exports = WechatMessage;