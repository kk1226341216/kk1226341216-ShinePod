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
const { wechatConfig, baiduAIConfig } = require('../config/config');

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
    logger.debug('开始解析微信XML消息');
    
    xml2js.parseString(xmlData, { 
      trim: true, 
      explicitArray: true, 
      ignoreAttrs: true 
    }, (err, result) => {
      if (err) {
        logger.error('解析微信XML消息失败', { error: err.message });
        reject(new AppError(400, '解析微信消息失败'));
      } else {
        logger.debug('解析微信XML消息成功');
        resolve(result);
      }
    });
  });
};

// 提取微信消息内容
const extractWechatMessage = (xmlResult) => {
  try {
    logger.debug('开始提取微信消息内容');
    
    if (!xmlResult || !xmlResult.xml) {
      throw new Error('无效的XML结果');
    }
    
    const message = xmlResult.xml;
    const extractedMessage = {
      toUserName: message.ToUserName && message.ToUserName.length > 0 ? message.ToUserName[0] : '',
      fromUserName: message.FromUserName && message.FromUserName.length > 0 ? message.FromUserName[0] : '',
      createTime: message.CreateTime && message.CreateTime.length > 0 ? message.CreateTime[0] : '',
      msgType: message.MsgType && message.MsgType.length > 0 ? message.MsgType[0] : '',
      content: message.Content && message.Content.length > 0 ? message.Content[0] : '',
      msgId: message.MsgId && message.MsgId.length > 0 ? message.MsgId[0] : '',
      mediaId: message.MediaId && message.MediaId.length > 0 ? message.MediaId[0] : '',
      format: message.Format && message.Format.length > 0 ? message.Format[0] : '',
      recognition: message.Recognition && message.Recognition.length > 0 ? message.Recognition[0] : ''
    };
    
    logger.debug('提取微信消息内容成功', { msgType: extractedMessage.msgType, fromUserName: extractedMessage.fromUserName });
    return extractedMessage;
  } catch (error) {
    logger.error('提取微信消息内容失败', { error: error.message });
    throw new AppError(400, '提取微信消息内容失败');
  }
};

// 百度AI Token缓存
let baiduAITokenCache = {
  token: null,
  expiryTime: 0
};

// 获取百度AI访问Token
const getBaiduAIToken = async () => {
  try {
    // 检查缓存是否有效
    const now = Date.now();
    if (baiduAITokenCache.token && now < baiduAITokenCache.expiryTime) {
      logger.debug('使用缓存的百度AI访问Token');
      return baiduAITokenCache.token;
    }
    
    const url = `${baiduAIConfig.tokenUrl}?grant_type=client_credentials&client_id=${baiduAIConfig.apiKey}&client_secret=${baiduAIConfig.secretKey}`;
    
    logger.debug('开始获取百度AI访问Token');
    
    return new Promise((resolve, reject) => {
      request.get(url, (error, response, body) => {
        if (error) {
          logger.error('获取百度AI访问Token失败', { error: error.message });
          reject(new AppError(500, '获取百度AI访问Token失败'));
        } else {
          try {
            const data = JSON.parse(body);
            if (data.error) {
              logger.error('百度AI返回错误', { error: data.error, error_description: data.error_description });
              reject(new AppError(500, `百度AI错误: ${data.error_description || data.error}`));
            } else {
              // 缓存token，有效期设置为比实际过期时间少5分钟，以防网络延迟等问题
              const expireInMs = (parseInt(data.expires_in) - 300) * 1000;
              baiduAITokenCache = {
                token: data.access_token,
                expiryTime: now + expireInMs
              };
              
              logger.debug('获取百度AI访问Token成功', { expiryTime: new Date(baiduAITokenCache.expiryTime).toISOString() });
              resolve(data.access_token);
            }
          } catch (err) {
            logger.error('解析百度AI Token响应失败', { error: err.message });
            reject(new AppError(500, '解析百度AI Token响应失败'));
          }
        }
      });
    });
  } catch (error) {
    logger.error('获取百度AI访问Token过程中发生错误', { error: error.message });
    throw error;
  }
};

// 下载微信语音文件
const downloadWechatVoice = async (mediaId) => {
  try {
    logger.debug('开始下载微信语音文件', { mediaId });
    
    // 获取微信AccessToken
    const accessToken = await getWechatAccessToken();
    const downloadUrl = `${wechatConfig.apiUrl}/cgi-bin/media/get?access_token=${accessToken}&media_id=${mediaId}`;
    
    // 创建临时文件路径
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    
    const tempFilePath = path.join(tempDir, `${mediaId}.amr`);
    
    return new Promise((resolve, reject) => {
      // 下载文件
      const file = fs.createWriteStream(tempFilePath);
      
      https.get(downloadUrl, (response) => {
        if (response.statusCode !== 200) {
          logger.error('下载微信语音文件失败', { statusCode: response.statusCode });
          reject(new AppError(500, '下载微信语音文件失败'));
          return;
        }
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close(() => {
            logger.debug('微信语音文件下载成功', { filePath: tempFilePath });
            resolve(tempFilePath);
          });
        });
      }).on('error', (error) => {
        fs.unlink(tempFilePath, () => {}); // 出错时删除文件
        logger.error('下载微信语音文件过程中发生错误', { error: error.message });
        reject(new AppError(500, '下载微信语音文件失败'));
      });
    });
  } catch (error) {
    logger.error('下载微信语音文件失败', { error: error.message });
    throw error;
  }
};

// 调用百度AI进行语音识别
const recognizeVoice = async (voiceMediaId) => {
  try {
    logger.debug('开始进行语音识别', { mediaId: voiceMediaId });
    
    if (!voiceMediaId) {
      throw new Error('语音MediaId不能为空');
    }
    
    // 下载语音文件
    const voiceFilePath = await downloadWechatVoice(voiceMediaId);
    
    try {
      // 读取文件内容
      const voiceData = await readFile(voiceFilePath);
      const voiceBase64 = voiceData.toString('base64');
      
      // 获取百度AI访问Token
      const token = await getBaiduAIToken();
      
      // 构建百度AI语音识别请求参数
      const requestBody = {
        format: 'amr', // 微信语音文件格式为amr
        rate: 8000, // 微信语音采样率为8000Hz
        channel: 1,
        cuid: 'shinpod',
        token: token,
        dev_pid: 1537, // 中文普通话
        speech: voiceBase64,
        len: voiceData.length
      };
      
      const url = `${baiduAIConfig.asrUrl}?cuid=shinpod&token=${token}&dev_pid=1537`;
      
      logger.debug('发送语音识别请求到百度AI');
      
      // 发送请求到百度AI
      const result = await new Promise((resolve, reject) => {
        request.post({
          url: url,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }, (error, response, body) => {
          if (error) {
            logger.error('百度AI语音识别请求失败', { error: error.message });
            reject(new AppError(500, '百度AI语音识别请求失败'));
          } else {
            try {
              const data = JSON.parse(body);
              if (data.err_no !== 0) {
                logger.error('百度AI语音识别失败', { err_no: data.err_no, err_msg: data.err_msg });
                reject(new AppError(500, `百度AI语音识别失败: ${data.err_msg}`));
              } else {
                logger.debug('百度AI语音识别成功', { result: data.result });
                resolve(data.result[0]);
              }
            } catch (err) {
              logger.error('解析百度AI语音识别响应失败', { error: err.message });
              reject(new AppError(500, '解析百度AI语音识别响应失败'));
            }
          }
        });
      });
      
      logger.debug('语音识别成功', { recognizedText: result });
      return result;
    } finally {
      // 无论成功与否，都删除临时文件
      if (fs.existsSync(voiceFilePath)) {
        fs.unlinkSync(voiceFilePath);
        logger.debug('临时语音文件已删除', { filePath: voiceFilePath });
      }
    }
  } catch (error) {
    logger.error('语音识别失败', { error: error.message });
    throw new AppError(500, '语音识别失败');
  }
};

// 处理微信消息
const processWechatMessage = async (message) => {
  try {
    logger.info('开始处理微信消息', { msgType: message.msgType, fromUserName: message.fromUserName });
    
    // 构建消息对象
    const wechatMessage = {
      wechat_msg_id: message.msgId,
      user_id: message.fromUserName,
      content_type: message.msgType === 'text' ? 'text' : 
                  message.msgType === 'voice' ? 'voice' : 'unknown',
      raw_content: message.msgType === 'text' ? message.content : message.mediaId || '',
      converted_text: message.msgType === 'text' ? message.content : null,
      created_at: new Date(parseInt(message.createTime) * 1000),
      status: 'pending'
    };
    
    // 如果是语音消息，进行语音识别
    if (message.msgType === 'voice') {
      if (message.recognition) {
        // 微信服务器已提供识别结果
        wechatMessage.converted_text = message.recognition;
        logger.debug('使用微信服务器提供的语音识别结果');
      } else {
        try {
          // 直接传递mediaId给语音识别函数
          const recognizedText = await recognizeVoice(message.mediaId);
          wechatMessage.converted_text = recognizedText;
        } catch (error) {
          logger.error('语音识别失败', { error: error.message });
          // 即使语音识别失败，也继续处理消息
        }
      }
    }
    
    // 保存消息到数据库
    const savedMessage = await WechatMessage.create(wechatMessage);
    logger.info('微信消息保存到数据库成功', { messageId: savedMessage._id });
    
    // 通过WebSocket同步消息给App客户端
    if (global.webSocketUtils) {
      const messageData = {
        type: 'wechat_message',
        data: savedMessage
      };
      
      // 发送给指定用户
      const sentToUser = global.webSocketUtils.sendToUser(message.fromUserName, messageData);
      
      if (sentToUser) {
        logger.debug('通过WebSocket将消息同步给指定用户成功', { userId: message.fromUserName });
      } else {
        logger.info('用户未连接WebSocket或发送失败', { userId: message.fromUserName });
      }
    } else {
      logger.warn('WebSocket工具未初始化，无法同步消息');
    }
    
    return savedMessage;
  } catch (error) {
    logger.error('处理微信消息失败', { error: error.message });
    throw new AppError(500, '处理微信消息失败');
  }
};

// 生成微信回复消息
const generateWechatReply = (message, content) => {
  try {
    logger.debug('开始生成微信回复消息');
    
    if (!message || !message.fromUserName || !message.toUserName) {
      throw new Error('无效的消息对象');
    }
    
    const reply = `
      <xml>
        <ToUserName><![CDATA[${message.fromUserName}]]></ToUserName>
        <FromUserName><![CDATA[${message.toUserName}]]></FromUserName>
        <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
        <MsgType><![CDATA[text]]></MsgType>
        <Content><![CDATA[${content || ''}]]></Content>
      </xml>
    `;
    
    logger.debug('生成微信回复消息成功');
    return reply;
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
            logger.error('解析微信AccessToken响应失败', { error: err.message });
            reject(new AppError(500, '解析微信AccessToken响应失败'));
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
  processWechatMessage,
  generateWechatReply,
  getWechatAccessToken,
  sendWechatTemplateMessage
};