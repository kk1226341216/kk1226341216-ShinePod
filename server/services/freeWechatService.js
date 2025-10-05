const crypto = require('crypto');
const request = require('request');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { promisify } = require('util');

// 引入Promise版本的fs.readFile
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

// 引入模型
const WechatMessage = require('../models/wechatMessageModel');

// 引入配置
const { wechatConfig } = require('../config/config');

// 引入工具
const logger = require('../utils/logger');
const { AppError } = require('../utils/errorHandler');

// 微信消息验证
const verifyWechatMessage = (req, res, next) => {
  try {
    const { signature, timestamp, nonce, echostr } = req.query;
    const token = wechatConfig.token;
    
    logger.debug('开始验证微信消息签名', { signature, timestamp, nonce });
    
    // 验证参数是否存在
    if (!signature || !timestamp || !nonce) {
      logger.warn('微信消息验证失败：缺少必要参数');
      return res.status(400).send('Invalid request');
    }
    
    // 排序并拼接
    const arr = [token, timestamp, nonce].sort();
    const str = arr.join('');
    
    // 计算SHA1哈希
    const sha1 = crypto.createHash('sha1').update(str).digest('hex');
    
    // 验证签名
    if (sha1 === signature) {
      logger.debug('微信消息签名验证成功');
      // 如果是首次验证，返回echostr
      if (echostr) {
        return res.send(echostr);
      }
      next();
    } else {
      logger.warn('微信消息签名验证失败', { expected: sha1, received: signature });
      res.status(403).send('Invalid signature');
    }
  } catch (error) {
    logger.error('微信消息验证过程中发生错误', { error: error.message });
    res.status(500).send('Internal server error');
  }
};

// 解析微信XML消息
const parseWechatXML = (xmlData) => {
  return new Promise((resolve, reject) => {
    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: true
    });
    
    parser.parseString(xmlData, (err, result) => {
      if (err) {
        logger.error('解析微信XML消息失败', { error: err.message });
        reject(new AppError(400, '解析微信XML消息失败'));
      } else {
        resolve(result.xml);
      }
    });
  });
};

// 提取微信消息内容
const extractWechatMessage = (message) => {
  try {
    const { MsgType, Content, MediaId, Recognition, PicUrl, Location_X, Location_Y, Label, Url, Title, Description } = message;
    
    let content_type = MsgType;
    let raw_content = '';
    let converted_text = '';
    
    switch (MsgType) {
      case 'text':
        raw_content = Content;
        converted_text = Content;
        break;
        
      case 'voice':
        raw_content = MediaId;
        // 🆓 使用微信自带的语音识别结果（免费）
        converted_text = Recognition || '语音消息（未识别）';
        logger.info('🎤 使用微信自带语音识别', { 
          mediaId: MediaId, 
          recognition: Recognition 
        });
        break;
        
      case 'image':
        raw_content = MediaId;
        converted_text = `图片消息: ${PicUrl || MediaId}`;
        break;
        
      case 'video':
        raw_content = MediaId;
        converted_text = '视频消息';
        break;
        
      case 'location':
        raw_content = `${Location_X},${Location_Y}`;
        converted_text = `位置信息: ${Label}`;
        break;
        
      case 'link':
        raw_content = Url;
        converted_text = `链接消息: ${Title} - ${Description}`;
        break;
        
      default:
        raw_content = JSON.stringify(message);
        converted_text = `未知消息类型: ${MsgType}`;
    }
    
    return {
      content_type,
      raw_content,
      converted_text
    };
  } catch (error) {
    logger.error('提取微信消息内容失败', { error: error.message });
    throw new AppError(400, '提取微信消息内容失败');
  }
};

// 🆓 免费语音识别处理（使用微信自带识别）
const processVoiceMessage = async (voiceMediaId, recognition = null) => {
  try {
    logger.debug('🎤 处理语音消息（免费方案）', { mediaId: voiceMediaId });
    
    if (!voiceMediaId) {
      throw new Error('语音MediaId不能为空');
    }
    
    // 🆓 优先使用微信自带的语音识别结果
    if (recognition) {
      logger.info('✅ 使用微信自带语音识别结果', { recognition });
      return recognition;
    }
    
    // 🆓 如果没有识别结果，返回提示信息
    logger.warn('⚠️ 微信语音消息无识别结果，建议用户重新发送');
    return '语音消息（建议重新发送以获得识别结果）';
    
  } catch (error) {
    logger.error('❌ 语音消息处理失败', { error: error.message });
    return '语音消息处理失败';
  }
};

// 处理微信消息
const processWechatMessage = async (message) => {
  try {
    logger.debug('开始处理微信消息', { message });
    
    // 提取消息内容
    const messageContent = extractWechatMessage(message);
    
    // 如果是语音消息，使用免费语音识别
    if (messageContent.content_type === 'voice') {
      const recognition = message.MsgType === 'voice' ? message.Recognition : null;
      messageContent.converted_text = await processVoiceMessage(
        messageContent.raw_content, 
        recognition
      );
    }
    
    // 创建消息记录
    const wechatMessage = new WechatMessage({
      wechat_msg_id: message.MsgId,
      user_id: message.FromUserName,
      content_type: messageContent.content_type,
      raw_content: messageContent.raw_content,
      converted_text: messageContent.converted_text,
      status: 'pending'
    });
    
    // 保存到数据库
    await wechatMessage.save();
    
    logger.info('微信消息处理完成', { 
      messageId: wechatMessage._id,
      userId: message.FromUserName,
      contentType: messageContent.content_type
    });
    
    // 通过WebSocket发送给客户端
    const messageData = {
      type: 'wechat_message',
      data: wechatMessage
    };
    
    // 广播消息
    if (global.webSocketUtils) {
      global.webSocketUtils.broadcast(messageData);
    }
    
    return wechatMessage;
  } catch (error) {
    logger.error('处理微信消息失败', { error: error.message });
    throw new AppError(500, '处理微信消息失败');
  }
};

// 生成微信回复消息
const generateWechatReply = (toUser, fromUser, content) => {
  try {
    const replyXml = `
      <xml>
        <ToUserName><![CDATA[${toUser}]]></ToUserName>
        <FromUserName><![CDATA[${fromUser}]]></FromUserName>
        <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
        <MsgType><![CDATA[text]]></MsgType>
        <Content><![CDATA[${content}]]></Content>
      </xml>
    `;
    
    return replyXml;
  } catch (error) {
    logger.error('生成微信回复消息失败', { error: error.message });
    throw new AppError(500, '生成微信回复消息失败');
  }
};

// 微信AccessToken缓存
let wechatAccessTokenCache = {
  token: null,
  expiryTime: 0
};

// 获取微信AccessToken
const getWechatAccessToken = async () => {
  try {
    // 检查缓存是否有效
    const now = Date.now();
    if (wechatAccessTokenCache.token && now < wechatAccessTokenCache.expiryTime) {
      logger.debug('使用缓存的微信AccessToken');
      return wechatAccessTokenCache.token;
    }
    
    // 检查配置是否正确
    if (!wechatConfig.appid || !wechatConfig.secret) {
      logger.error('微信AppID或AppSecret未配置');
      throw new AppError(500, '微信配置错误');
    }
    
    const url = `${wechatConfig.apiUrl}/cgi-bin/token?grant_type=client_credential&appid=${wechatConfig.appid}&secret=${wechatConfig.secret}`;
    
    logger.debug('开始获取微信AccessToken');
    
    return new Promise((resolve, reject) => {
      request.get(url, (error, response, body) => {
        if (error) {
          logger.error('获取微信AccessToken失败', { error: error.message });
          reject(new AppError(500, '获取微信AccessToken失败'));
        } else {
          try {
            const data = JSON.parse(body);
            if (data.errcode) {
              logger.error('微信返回错误', { errcode: data.errcode, errmsg: data.errmsg });
              reject(new AppError(500, `微信错误: ${data.errmsg}`));
            } else {
              // 缓存token，有效期设置为比实际过期时间少5分钟
              const expireInMs = (parseInt(data.expires_in) - 300) * 1000;
              wechatAccessTokenCache = {
                token: data.access_token,
                expiryTime: now + expireInMs
              };
              
              logger.debug('获取微信AccessToken成功', { expiryTime: new Date(wechatAccessTokenCache.expiryTime).toISOString() });
              resolve(data.access_token);
            }
          } catch (err) {
            logger.error('解析微信Token响应失败', { error: err.message });
            reject(new AppError(500, '解析微信Token响应失败'));
          }
        }
      });
    });
  } catch (error) {
    logger.error('获取微信AccessToken过程中发生错误', { error: error.message });
    throw error;
  }
};

// 发送微信模板消息
const sendWechatTemplateMessage = async (openid, templateId, data) => {
  try {
    logger.info('开始发送微信模板消息', { openid, templateId });
    
    // 获取access_token
    const accessToken = await getWechatAccessToken();
    const url = `${wechatConfig.templateMessageUrl}?access_token=${accessToken}`;
    
    const messageData = {
      touser: openid,
      template_id: templateId,
      data: data
    };
    
    return new Promise((resolve, reject) => {
      request.post({
        url: url,
        json: messageData
      }, (error, response, body) => {
        if (error) {
          logger.error('发送模板消息失败', { error: error.message });
          reject(new AppError(500, '发送模板消息失败'));
        } else {
          if (body.errcode) {
            logger.error('微信发送模板消息失败', { errcode: body.errcode, errmsg: body.errmsg });
            reject(new AppError(500, `发送模板消息失败: ${body.errmsg}`));
          } else {
            logger.info('发送模板消息成功', { openid });
            resolve(body);
          }
        }
      });
    });
  } catch (error) {
    logger.error('发送模板消息过程中发生错误', { error: error.message });
    throw error;
  }
};

module.exports = {
  verifyWechatMessage,
  parseWechatXML,
  extractWechatMessage,
  processVoiceMessage,
  processWechatMessage,
  generateWechatReply,
  getWechatAccessToken,
  sendWechatTemplateMessage
};
