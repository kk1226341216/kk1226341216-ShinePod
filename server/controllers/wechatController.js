const { parseWechatXML, extractWechatMessage, processWechatMessage, generateWechatReply } = require('../services/wechatService');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errorHandler');

// 处理微信消息推送
const handleWechatMessage = async (req, res) => {
  try {
    // 解析微信XML消息
    const xmlResult = await parseWechatXML(req.rawBody || req.body);
    const message = extractWechatMessage(xmlResult);
    
    logger.info('收到微信消息', { msgType: message.msgType, fromUserName: message.fromUserName });
    
    // 根据消息类型进行处理
    switch (message.msgType) {
      case 'text':
        // 异步处理消息，避免微信接口超时
        setTimeout(async () => {
          try {
            await processWechatMessage(message);
            logger.debug('微信文本消息处理完成', { msgId: message.msgId });
          } catch (error) {
            logger.error('微信文本消息处理失败', { msgId: message.msgId, error: error.message });
          }
        }, 0);
        
        // 立即回复微信服务器，避免超时
        const textReplyContent = '✅ 已收到，内容将同步到你的拾光豆App';
        const textReplyXml = generateWechatReply(message, textReplyContent);
        res.type('application/xml');
        res.send(textReplyXml);
        break;
        
      case 'voice':
        // 立即回复微信服务器，避免超时
        const voiceReplyContent = '🎙️ 语音正在转文字中，稍后将同步到App';
        const voiceReplyXml = generateWechatReply(message, voiceReplyContent);
        res.type('application/xml');
        res.send(voiceReplyXml);
        
        // 异步处理语音消息和识别
        setTimeout(async () => {
          try {
            await processWechatMessage(message);
            logger.debug('微信语音消息处理完成', { msgId: message.msgId });
          } catch (error) {
            logger.error('微信语音消息处理失败', { msgId: message.msgId, error: error.message });
          }
        }, 0);
        break;
        
      case 'event':
        // 处理事件消息
        handleWechatEvent(message, res);
        break;
        
      default:
        // 其他消息类型，返回success
        res.send('success');
        break;
    }
  } catch (error) {
    logger.error('处理微信消息时出错', { error: error.message, stack: error.stack });
    throw new AppError(500, '处理微信消息失败');
  }
};

// 处理微信事件
const handleWechatEvent = (message, res) => {
  const event = message.Event || '';
  
  switch (event.toLowerCase()) {
    case 'subscribe':
      // 用户关注事件
      logger.info('用户关注公众号', { fromUserName: message.fromUserName });
      const welcomeReply = '欢迎关注拾光豆公众号！您的消息将会同步到拾光豆App中。';
      const welcomeXml = generateWechatReply(message, welcomeReply);
      res.type('application/xml');
      res.send(welcomeXml);
      break;
      
    case 'unsubscribe':
      // 用户取消关注事件
      logger.info('用户取消关注公众号', { fromUserName: message.fromUserName });
      // 这里可以实现解除账号绑定的逻辑
      res.send('success');
      break;
      
    case 'click':
      // 点击菜单事件
      handleMenuClick(message, res);
      break;
      
    default:
      // 其他事件，返回success
      logger.debug('收到未处理的微信事件', { event });
      res.send('success');
      break;
  }
};

// 处理菜单点击事件
const handleMenuClick = (message, res) => {
  const eventKey = message.EventKey || '';
  let replyContent = '感谢您的点击！';
  
  // 根据不同的菜单key返回不同的内容
  switch (eventKey) {
    case 'help':
      replyContent = '您可以发送文字或语音消息，我们会将内容同步到您的拾光豆App中。';
      break;
      
    case 'bind':
      replyContent = '请访问拾光豆App完成账号绑定。';
      break;
      
    default:
      logger.debug('收到未处理的菜单点击事件', { eventKey });
      break;
  }
  
  logger.info('用户点击菜单', { eventKey, fromUserName: message.fromUserName });
  const replyXml = generateWechatReply(message, replyContent);
  res.type('application/xml');
  res.send(replyXml);
};

// 获取微信公众号配置信息
const getWechatConfig = (req, res) => {
  try {
    const { wechatConfig } = require('../config/config');
    logger.debug('获取微信配置信息');
    res.status(200).json({
      appid: wechatConfig.appid,
      token: wechatConfig.token ? '已配置' : '未配置',
      encodingAESKey: wechatConfig.encodingAESKey ? '已配置' : '未配置'
    });
  } catch (error) {
    logger.error('获取微信配置时出错', { error: error.message });
    res.status(500).json({ error: '获取配置失败' });
  }
};

module.exports = {
  handleWechatMessage,
  getWechatConfig
};