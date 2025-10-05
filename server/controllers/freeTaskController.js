const path = require('path');
const fs = require('fs');

// 🆓 免费文件数据库任务控制器
class FreeTaskController {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.messagesFile = path.join(this.dataDir, 'messages.json');
    this.usersFile = path.join(this.dataDir, 'users.json');
    this.statsFile = path.join(this.dataDir, 'stats.json');
    
    // 确保数据目录存在
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    // 初始化数据文件
    this.initDataFiles();
  }
  
  initDataFiles() {
    if (!fs.existsSync(this.messagesFile)) {
      fs.writeFileSync(this.messagesFile, JSON.stringify([]));
    }
    if (!fs.existsSync(this.usersFile)) {
      fs.writeFileSync(this.usersFile, JSON.stringify([]));
    }
  }
  
  readMessages() {
    try {
      const data = fs.readFileSync(this.messagesFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('读取消息数据失败:', error.message);
      return [];
    }
  }
  
  saveMessages(messages) {
    try {
      fs.writeFileSync(this.messagesFile, JSON.stringify(messages, null, 2));
      return true;
    } catch (error) {
      console.error('保存消息数据失败:', error.message);
      return false;
    }
  }
  
  // 获取微信任务列表
  getWechatTasks = async (req, res) => {
    try {
      const { userId, limit = 20, skip = 0, status } = req.query;
      
      // 验证用户ID是否存在
      if (!userId) {
        return res.status(400).json({ error: '用户ID不能为空' });
      }
      
      // 读取所有消息
      const allMessages = this.readMessages();
      
      // 构建查询条件
      let filteredMessages = allMessages.filter(msg => msg.user_id === userId);
      
      // 如果指定了状态，添加到查询条件中
      if (status) {
        filteredMessages = filteredMessages.filter(msg => msg.status === status);
      }
      
      // 排序
      filteredMessages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      // 分页
      const total = filteredMessages.length;
      const messages = filteredMessages.slice(parseInt(skip), parseInt(skip) + parseInt(limit));
      
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
  getWechatTaskDetail = async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.query;
      
      // 验证参数
      if (!id || !userId) {
        return res.status(400).json({ success: false, error: '参数缺失' });
      }
      
      // 读取所有消息
      const allMessages = this.readMessages();
      
      // 查询任务详情
      const message = allMessages.find(msg => 
        msg._id === id && msg.user_id === userId
      );
      
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
  updateWechatTaskStatus = async (req, res) => {
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
      
      // 读取所有消息
      const allMessages = this.readMessages();
      
      // 查找并更新任务
      const messageIndex = allMessages.findIndex(msg => 
        msg._id === id && msg.user_id === userId
      );
      
      // 检查任务是否存在
      if (messageIndex === -1) {
        return res.status(404).json({ success: false, error: '任务不存在' });
      }
      
      // 更新任务状态
      allMessages[messageIndex].status = status;
      allMessages[messageIndex].updated_at = new Date();
      
      // 保存更新后的消息
      this.saveMessages(allMessages);
      
      // 返回结果
      res.status(200).json({ success: true, data: allMessages[messageIndex] });
    } catch (error) {
      console.error('更新微信任务状态时出错:', error);
      res.status(500).json({ success: false, error: '服务器内部错误' });
    }
  };
  
  // 批量获取待同步的微信任务
  getPendingWechatTasks = async (req, res) => {
    try {
      const { limit = 100 } = req.query;
      
      // 读取所有消息
      const allMessages = this.readMessages();
      
      // 查询待同步的任务
      const pendingTasks = allMessages
        .filter(msg => msg.status === 'pending')
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .slice(0, parseInt(limit));
      
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
  batchUpdateWechatTaskStatus = async (req, res) => {
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
      
      // 读取所有消息
      const allMessages = this.readMessages();
      
      // 批量更新任务状态
      let modifiedCount = 0;
      allMessages.forEach(msg => {
        if (ids.includes(msg._id)) {
          msg.status = status;
          msg.updated_at = new Date();
          modifiedCount++;
        }
      });
      
      // 保存更新后的消息
      this.saveMessages(allMessages);
      
      // 返回结果
      res.status(200).json({
        success: true,
        modifiedCount
      });
    } catch (error) {
      console.error('批量更新微信任务状态时出错:', error);
      res.status(500).json({ success: false, error: '服务器内部错误' });
    }
  };
  
  // 搜索微信任务
  searchWechatTasks = async (req, res) => {
    try {
      const { userId, keyword, contentType, startDate, endDate, limit = 20, skip = 0 } = req.query;
      
      // 验证用户ID是否存在
      if (!userId) {
        return res.status(400).json({ error: '用户ID不能为空' });
      }
      
      // 读取所有消息
      const allMessages = this.readMessages();
      
      // 构建查询条件
      let filteredMessages = allMessages.filter(msg => msg.user_id === userId);
      
      // 关键词搜索
      if (keyword) {
        filteredMessages = filteredMessages.filter(msg => 
          msg.converted_text && msg.converted_text.includes(keyword)
        );
      }
      
      // 内容类型过滤
      if (contentType) {
        filteredMessages = filteredMessages.filter(msg => msg.content_type === contentType);
      }
      
      // 日期范围过滤
      if (startDate) {
        filteredMessages = filteredMessages.filter(msg => 
          new Date(msg.created_at) >= new Date(startDate)
        );
      }
      
      if (endDate) {
        filteredMessages = filteredMessages.filter(msg => 
          new Date(msg.created_at) <= new Date(endDate)
        );
      }
      
      // 排序
      filteredMessages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      // 分页
      const total = filteredMessages.length;
      const messages = filteredMessages.slice(parseInt(skip), parseInt(skip) + parseInt(limit));
      
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
  };
}

// 创建实例
const freeTaskController = new FreeTaskController();

module.exports = {
  getWechatTasks: freeTaskController.getWechatTasks,
  getWechatTaskDetail: freeTaskController.getWechatTaskDetail,
  updateWechatTaskStatus: freeTaskController.updateWechatTaskStatus,
  getPendingWechatTasks: freeTaskController.getPendingWechatTasks,
  batchUpdateWechatTaskStatus: freeTaskController.batchUpdateWechatTaskStatus,
  searchWechatTasks: freeTaskController.searchWechatTasks
};
