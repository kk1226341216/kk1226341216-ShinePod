const express = require('express');
const router = express.Router();
const { handleWechatMessage, getWechatConfig } = require('../controllers/wechatController');
const { verifyWechatMessage } = require('../services/wechatService');

// 中间件：处理rawBody，用于微信消息验证
const rawBodyParser = (req, res, next) => {
  req.rawBody = '';
  req.setEncoding('utf8');
  
  req.on('data', chunk => {
    req.rawBody += chunk;
  });
  
  req.on('end', () => {
    next();
  });
};

// 微信消息验证和接收接口
router.get('/message', verifyWechatMessage, (req, res) => {
  // 微信服务器验证请求，verifyWechatMessage中间件已经处理了响应
});

router.post('/message', rawBodyParser, verifyWechatMessage, handleWechatMessage);

// 获取微信配置信息接口
router.get('/config', getWechatConfig);

// 微信OAuth授权接口
router.get('/oauth', (req, res) => {
  const { wechatConfig } = require('../config/config');
  const { redirect_uri, state = 'STATE' } = req.query;
  
  if (!redirect_uri) {
    return res.status(400).json({ error: 'redirect_uri参数缺失' });
  }
  
  // 构造OAuth授权URL
  const encodedRedirectUri = encodeURIComponent(redirect_uri);
  const oauthUrl = `${wechatConfig.oauthUrl}?appid=${wechatConfig.appid}&redirect_uri=${encodedRedirectUri}&response_type=code&scope=snsapi_userinfo&state=${state}#wechat_redirect`;
  
  // 重定向到微信授权页面
  res.redirect(oauthUrl);
});

// 微信OAuth回调接口
router.get('/oauth/callback', async (req, res) => {
  const { code, state } = req.query;
  
  if (!code) {
    return res.status(400).json({ error: '授权失败，没有获取到code' });
  }
  
  try {
    const { wechatConfig } = require('../config/config');
    const request = require('request');
    
    // 构造获取access_token的URL
    const tokenUrl = `${wechatConfig.apiUrl}/sns/oauth2/access_token?appid=${wechatConfig.appid}&secret=${wechatConfig.secret}&code=${code}&grant_type=authorization_code`;
    
    // 发送请求获取access_token
    request.get(tokenUrl, (error, response, body) => {
      if (error) {
        console.error('获取微信access_token失败:', error);
        return res.status(500).json({ error: '获取授权信息失败' });
      }
      
      try {
        const tokenData = JSON.parse(body);
        
        // 检查是否有错误
        if (tokenData.errcode) {
          console.error('微信授权失败:', tokenData.errmsg);
          return res.status(400).json({ error: tokenData.errmsg });
        }
        
        // 这里可以根据需要处理授权信息，例如获取用户信息、生成会话等
        
        // 重定向回原始应用，并带上授权信息
        const returnUrl = new URL(state);
        
        // 在查询参数中添加授权信息
        returnUrl.searchParams.append('access_token', tokenData.access_token);
        returnUrl.searchParams.append('openid', tokenData.openid);
        
        // 重定向回应用
        res.redirect(returnUrl.toString());
      } catch (err) {
        console.error('解析微信授权响应失败:', err);
        res.status(500).json({ error: '解析授权信息失败' });
      }
    });
  } catch (error) {
    console.error('处理微信授权回调时出错:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取微信服务器IP列表接口
router.get('/serverips', async (req, res) => {
  try {
    // 实际应用中需要先获取access_token
    const accessToken = 'ACCESS_TOKEN';
    const { wechatConfig } = require('../config/config');
    const request = require('request');
    
    const url = `${wechatConfig.apiUrl}/cgi-bin/getcallbackip?access_token=${accessToken}`;
    
    request.get(url, (error, response, body) => {
      if (error) {
        console.error('获取微信服务器IP列表失败:', error);
        return res.status(500).json({ error: '获取IP列表失败' });
      }
      
      try {
        const data = JSON.parse(body);
        res.status(200).json(data);
      } catch (err) {
        console.error('解析微信服务器IP列表失败:', err);
        res.status(500).json({ error: '解析IP列表失败' });
      }
    });
  } catch (error) {
    console.error('获取微信服务器IP列表时出错:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;