const express = require('express');
const router = express.Router();
const { getWechatTasks, getWechatTaskDetail, updateWechatTaskStatus, getPendingWechatTasks, batchUpdateWechatTaskStatus } = require('../controllers/taskController');

// 获取微信任务列表
router.get('/wechat', getWechatTasks);

// 获取单个微信任务详情
router.get('/wechat/:id', getWechatTaskDetail);

// 更新微信任务状态
router.put('/wechat/:id/status', updateWechatTaskStatus);

// 获取待同步的微信任务
router.get('/wechat/pending', getPendingWechatTasks);

// 批量更新微信任务状态
router.put('/wechat/batch/status', batchUpdateWechatTaskStatus);

// 搜索微信任务
router.get('/wechat/search', async (req, res) => {
  try {
    const { userId, keyword, startDate, endDate, contentType, limit = 20, skip = 0 } = req.query;
    
    // 验证用户ID是否存在
    if (!userId) {
      return res.status(400).json({ success: false, error: '用户ID不能为空' });
    }
    
    // 构建查询条件
    const query = { user_id: userId };
    
    // 添加关键词搜索条件
    if (keyword) {
      query.$or = [
        { content: { $regex: keyword, $options: 'i' } },
        { converted_text: { $regex: keyword, $options: 'i' } }
      ];
    }
    
    // 添加日期范围条件
    if (startDate || endDate) {
      query.created_at = {};
      if (startDate) {
        query.created_at.$gte = new Date(startDate);
      }
      if (endDate) {
        query.created_at.$lte = new Date(endDate);
      }
    }
    
    // 添加消息类型条件
    if (contentType) {
      query.content_type = contentType;
    }
    
    // 导入模型
    const WechatMessage = require('../models/wechatMessageModel');
    
    // 查询消息列表
    const messages = await WechatMessage.find(query)
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));
    
    // 查询总数
    const total = await WechatMessage.countDocuments(query);
    
    // 返回结果
    res.status(200).json({
      success: true,
      data: messages,
      total,
      page: Math.floor(parseInt(skip) / parseInt(limit)) + 1,
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('搜索微信任务时出错:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// 统计微信任务
router.get('/wechat/stats', async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;
    
    // 验证用户ID是否存在
    if (!userId) {
      return res.status(400).json({ success: false, error: '用户ID不能为空' });
    }
    
    // 构建查询条件
    const query = { user_id: userId };
    
    // 添加日期范围条件
    if (startDate || endDate) {
      query.created_at = {};
      if (startDate) {
        query.created_at.$gte = new Date(startDate);
      }
      if (endDate) {
        query.created_at.$lte = new Date(endDate);
      }
    }
    
    // 导入模型
    const WechatMessage = require('../models/wechatMessageModel');
    
    // 统计总数
    const totalCount = await WechatMessage.countDocuments(query);
    
    // 按消息类型统计
    const typeStats = await WechatMessage.aggregate([
      { $match: query },
      { $group: { _id: '$content_type', count: { $sum: 1 } } }
    ]);
    
    // 按状态统计
    const statusStats = await WechatMessage.aggregate([
      { $match: query },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    // 返回结果
    res.status(200).json({
      success: true,
      data: {
        total: totalCount,
        typeStats: typeStats,
        statusStats: statusStats
      }
    });
  } catch (error) {
    console.error('统计微信任务时出错:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

module.exports = router;