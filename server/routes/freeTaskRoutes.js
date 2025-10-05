const express = require('express');
const router = express.Router();
const { 
  getWechatTasks, 
  getWechatTaskDetail, 
  updateWechatTaskStatus, 
  getPendingWechatTasks, 
  batchUpdateWechatTaskStatus,
  searchWechatTasks 
} = require('../controllers/freeTaskController');

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
router.get('/wechat/search', searchWechatTasks);

// 统计微信任务
router.get('/wechat/stats', async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;
    
    // 验证用户ID是否存在
    if (!userId) {
      return res.status(400).json({ success: false, error: '用户ID不能为空' });
    }
    
    // 读取所有消息
    const path = require('path');
    const fs = require('fs');
    const messagesFile = path.join(__dirname, '../../data/messages.json');
    
    let allMessages = [];
    try {
      const data = fs.readFileSync(messagesFile, 'utf8');
      allMessages = JSON.parse(data);
    } catch (error) {
      console.error('读取消息数据失败:', error.message);
    }
    
    // 构建查询条件
    let filteredMessages = allMessages.filter(msg => msg.user_id === userId);
    
    // 添加日期范围条件
    if (startDate || endDate) {
      filteredMessages = filteredMessages.filter(msg => {
        const msgDate = new Date(msg.created_at);
        if (startDate && msgDate < new Date(startDate)) return false;
        if (endDate && msgDate > new Date(endDate)) return false;
        return true;
      });
    }
    
    // 统计总数
    const totalCount = filteredMessages.length;
    
    // 按消息类型统计
    const typeStats = {};
    filteredMessages.forEach(msg => {
      const type = msg.content_type || 'unknown';
      typeStats[type] = (typeStats[type] || 0) + 1;
    });
    
    // 按状态统计
    const statusStats = {};
    filteredMessages.forEach(msg => {
      const status = msg.status || 'unknown';
      statusStats[status] = (statusStats[status] || 0) + 1;
    });
    
    // 转换为数组格式
    const typeStatsArray = Object.entries(typeStats).map(([_id, count]) => ({ _id, count }));
    const statusStatsArray = Object.entries(statusStats).map(([_id, count]) => ({ _id, count }));
    
    // 返回结果
    res.status(200).json({
      success: true,
      data: {
        total: totalCount,
        typeStats: typeStatsArray,
        statusStats: statusStatsArray
      }
    });
  } catch (error) {
    console.error('统计微信任务时出错:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

module.exports = router;
