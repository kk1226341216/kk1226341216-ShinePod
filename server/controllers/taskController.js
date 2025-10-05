const WechatMessage = require('../models/wechatMessageModel');

// 获取微信任务列表
const getWechatTasks = async (req, res) => {
  try {
    const { userId, limit = 20, skip = 0, status } = req.query;
    
    // 验证用户ID是否存在
    if (!userId) {
      return res.status(400).json({ error: '用户ID不能为空' });
    }
    
    // 构建查询条件
    const query = { user_id: userId };
    
    // 如果指定了状态，添加到查询条件中
    if (status) {
      query.status = status;
    }
    
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
    console.error('获取微信任务列表时出错:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
};

// 获取单个微信任务详情
const getWechatTaskDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;
    
    // 验证参数
    if (!id || !userId) {
      return res.status(400).json({ success: false, error: '参数缺失' });
    }
    
    // 查询任务详情
    const message = await WechatMessage.findOne({
      _id: id,
      user_id: userId
    });
    
    // 检查任务是否存在
    if (!message) {
      return res.status(404).json({ success: false, error: '任务不存在' });
    }
    
    // 返回结果
    res.status(200).json({ success: true, data: message });
  } catch (error) {
    console.error('获取微信任务详情时出错:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
};

// 更新微信任务状态
const updateWechatTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, status } = req.body;
    
    // 验证参数
    if (!id || !userId || !status) {
      return res.status(400).json({ success: false, error: '参数缺失' });
    }
    
    // 验证状态值
    const validStatuses = ['pending', 'synced', 'failed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: '无效的状态值' });
    }
    
    // 更新任务状态
    const updatedMessage = await WechatMessage.findOneAndUpdate(
      {
        _id: id,
        user_id: userId
      },
      {
        status: status,
        updated_at: Date.now()
      },
      {
        new: true // 返回更新后的文档
      }
    );
    
    // 检查任务是否存在
    if (!updatedMessage) {
      return res.status(404).json({ success: false, error: '任务不存在' });
    }
    
    // 返回结果
    res.status(200).json({ success: true, data: updatedMessage });
  } catch (error) {
    console.error('更新微信任务状态时出错:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
};

// 批量获取待同步的微信任务
const getPendingWechatTasks = async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    
    // 查询待同步的任务
    const pendingTasks = await WechatMessage.findPendingMessages({
      limit: parseInt(limit)
    });
    
    // 返回结果
    res.status(200).json({
      success: true,
      data: pendingTasks,
      total: pendingTasks.length
    });
  } catch (error) {
    console.error('获取待同步微信任务时出错:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
};

// 批量更新微信任务状态
const batchUpdateWechatTaskStatus = async (req, res) => {
  try {
    const { ids, status } = req.body;
    
    // 验证参数
    if (!ids || !Array.isArray(ids) || ids.length === 0 || !status) {
      return res.status(400).json({ success: false, error: '参数缺失' });
    }
    
    // 验证状态值
    const validStatuses = ['pending', 'synced', 'failed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: '无效的状态值' });
    }
    
    // 批量更新任务状态
    const result = await WechatMessage.updateMany(
      {
        _id: { $in: ids }
      },
      {
        $set: {
          status: status,
          updated_at: Date.now()
        }
      }
    );
    
    // 返回结果
    res.status(200).json({
      success: true,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('批量更新微信任务状态时出错:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
};

module.exports = {
  getWechatTasks,
  getWechatTaskDetail,
  updateWechatTaskStatus,
  getPendingWechatTasks,
  batchUpdateWechatTaskStatus
};