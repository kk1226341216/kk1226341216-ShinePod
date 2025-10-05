const xml2js = require('xml2js');
const crypto = require('crypto');
const parser = new xml2js.Parser({
  explicitArray: false,
  trim: true,
  normalizeTags: true,
  normalize: true
});
const builder = new xml2js.Builder({
  cdata: true,
  rootName: 'xml',
  headless: true
});

// 解析微信XML消息
export const parseWechatXML = async (xmlString) => {
  return new Promise((resolve, reject) => {
    parser.parseString(xmlString, (err, result) => {
      if (err) {
        reject(new Error(`解析XML失败: ${err.message}`));
        return;
      }
      resolve(result);
    });
  });
};

// 生成微信XML响应
export const generateWechatXML = async (data) => {
  return new Promise((resolve, reject) => {
    try {
      const xml = builder.buildObject(data);
      resolve(xml);
    } catch (error) {
      reject(new Error(`生成XML失败: ${error.message}`));
    }
  });
};

// 从XML解析结果中提取微信消息
export const extractWechatMessage = (xmlResult) => {
  if (!xmlResult || !xmlResult.xml) {
    throw new Error('无效的XML结果');
  }
  
  const xmlData = xmlResult.xml;
  const message = {};
  
  // 提取基本信息
  message.toUserName = xmlData.tousername || '';
  message.fromUserName = xmlData.fromusername || '';
  message.createTime = parseInt(xmlData.createtime || Date.now());
  message.msgType = xmlData.msgtype || '';
  
  // 根据消息类型提取不同的内容
  switch (message.msgType) {
    case 'text':
      message.content = xmlData.content || '';
      message.msgId = xmlData.msgid || '';
      break;
      
    case 'image':
      message.picUrl = xmlData.picurl || '';
      message.mediaId = xmlData.mediaid || '';
      message.msgId = xmlData.msgid || '';
      break;
      
    case 'voice':
      message.mediaId = xmlData.mediaid || '';
      message.format = xmlData.format || '';
      message.recognition = xmlData.recognition || '';
      message.msgId = xmlData.msgid || '';
      break;
      
    case 'video':
      message.mediaId = xmlData.mediaid || '';
      message.thumbMediaId = xmlData.thumbmediaid || '';
      message.msgId = xmlData.msgid || '';
      break;
      
    case 'location':
      message.locationX = parseFloat(xmlData.location_x || 0);
      message.locationY = parseFloat(xmlData.location_y || 0);
      message.scale = parseInt(xmlData.scale || 0);
      message.label = xmlData.label || '';
      message.msgId = xmlData.msgid || '';
      break;
      
    case 'link':
      message.title = xmlData.title || '';
      message.description = xmlData.description || '';
      message.url = xmlData.url || '';
      message.msgId = xmlData.msgid || '';
      break;
      
    case 'event':
      message.event = xmlData.event || '';
      message.eventKey = xmlData.eventkey || '';
      message.ticket = xmlData.ticket || '';
      
      // 处理不同类型的事件
      if (message.event === 'LOCATION') {
        message.latitude = parseFloat(xmlData.latitude || 0);
        message.longitude = parseFloat(xmlData.longitude || 0);
        message.precision = parseFloat(xmlData.precision || 0);
      } else if (message.event === 'CLICK') {
        message.eventKey = xmlData.eventkey || '';
      } else if (message.event === 'VIEW') {
        message.eventKey = xmlData.eventkey || '';
      }
      break;
      
    default:
      // 处理未知消息类型
      break;
  }
  
  return message;
};

// 生成微信消息回复XML
const generateWechatReply = (message, content, msgType = 'text') => {
  const replyData = {
    xml: {
      ToUserName: {
        _cdata: message.fromUserName
      },
      FromUserName: {
        _cdata: message.toUserName
      },
      CreateTime: Date.now(),
      MsgType: {
        _cdata: msgType
      }
    }
  };
  
  // 根据消息类型添加不同的内容
  switch (msgType) {
    case 'text':
      replyData.xml.Content = {
        _cdata: content
      };
      break;
      
    case 'image':
      replyData.xml.Image = {
        MediaId: {
          _cdata: content
        }
      };
      break;
      
    case 'voice':
      replyData.xml.Voice = {
        MediaId: {
          _cdata: content
        }
      };
      break;
      
    case 'video':
      replyData.xml.Video = {
        MediaId: {
          _cdata: content.mediaId
        },
        Title: {
          _cdata: content.title || ''
        },
        Description: {
          _cdata: content.description || ''
        }
      };
      break;
      
    case 'music':
      replyData.xml.Music = {
        Title: {
          _cdata: content.title || ''
        },
        Description: {
          _cdata: content.description || ''
        },
        MusicUrl: {
          _cdata: content.musicUrl || ''
        },
        HQMusicUrl: {
          _cdata: content.hqMusicUrl || ''
        },
        ThumbMediaId: {
          _cdata: content.thumbMediaId || ''
        }
      };
      break;
      
    case 'news':
      replyData.xml.ArticleCount = content.length;
      replyData.xml.Articles = {
        item: content.map(item => ({
          Title: {
            _cdata: item.title || ''
          },
          Description: {
            _cdata: item.description || ''
          },
          PicUrl: {
            _cdata: item.picUrl || ''
          },
          Url: {
            _cdata: item.url || ''
          }
        }))
      };
      break;
      
    default:
      // 默认为文本消息
      replyData.xml.Content = {
        _cdata: content
      };
      break;
  }
  
  // 使用同步方式生成XML
  try {
    return builder.buildObject(replyData);
  } catch (error) {
    console.error('生成XML回复失败:', error);
    // 返回简单的文本回复
    return `<xml><ToUserName><![CDATA[${message.fromUserName}]]></ToUserName><FromUserName><![CDATA[${message.toUserName}]]></FromUserName><CreateTime>${Date.now()}</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[${content}]]></Content></xml>`;
  }
};

// 验证微信消息签名
const verifyWechatSignature = (token, signature, timestamp, nonce) => {
  const crypto = require('crypto');
  
  // 1. 将token、timestamp、nonce三个参数进行字典序排序
  const arr = [token, timestamp, nonce].sort();
  
  // 2. 将三个参数字符串拼接成一个字符串进行sha1加密
  const str = arr.join('');
  const hash = crypto.createHash('sha1').update(str).digest('hex');
  
  // 3. 开发者获得加密后的字符串可与signature对比，标识该请求来源于微信
  return hash === signature;
};

// 将对象转换为查询字符串
const objToQueryString = (obj) => {
  return Object.keys(obj)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`)
    .join('&');
};

// 从XML中提取CDATA内容
const extractCDATA = (xml) => {
  const cdataRegex = /<!\[CDATA\[(.*?)\]\]>/g;
  const matches = [];
  let match;
  
  while ((match = cdataRegex.exec(xml)) !== null) {
    matches.push(match[1]);
  }
  
  return matches;
};

// 导出所有函数
module.exports = {
  parseWechatXML,
  generateWechatXML,
  extractWechatMessage,
  generateWechatReply,
  verifyWechatSignature,
  objToQueryString,
  extractCDATA
};