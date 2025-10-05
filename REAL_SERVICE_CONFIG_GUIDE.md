# 🔧 真实服务配置指南

## 📱 微信公众号配置步骤

### 1. 申请微信公众号
1. 访问 https://mp.weixin.qq.com/
2. 使用微信扫码登录
3. 如果没有公众号，点击"立即注册"

### 2. 获取配置信息
1. 登录后，进入"设置与开发" → "基本配置"
2. 记录以下信息：
   - **AppID**: 应用ID（类似：wx1234567890abcdef）
   - **AppSecret**: 应用密钥（类似：abcdef1234567890abcdef1234567890）
   - **Token**: 令牌（需要自己设置，建议使用随机字符串）

### 3. 配置服务器信息
1. 在"基本配置"页面：
   - **服务器地址(URL)**: `https://your-domain.com/wechat/message`
   - **令牌(Token)**: 与.env文件中的WECHAT_TOKEN保持一致
   - **消息加解密方式**: 选择"兼容模式"

### 4. 配置授权回调域名
1. 进入"设置与开发" → "接口权限"
2. 找到"网页授权域名"
3. 设置为你的服务器域名

---

## 🤖 百度AI配置步骤

### 1. 申请百度AI账号
1. 访问 https://ai.baidu.com/
2. 注册并登录账号

### 2. 创建应用
1. 进入"控制台" → "应用列表"
2. 点击"创建应用"
3. 填写应用信息：
   - **应用名称**: 拾光豆语音识别
   - **应用类型**: 选择"语音技术"
   - **接口选择**: 勾选"语音识别"

### 3. 获取密钥信息
1. 创建完成后，在应用列表中点击应用
2. 记录以下信息：
   - **API Key**: API密钥
   - **Secret Key**: 密钥

---

## 🗄️ MongoDB数据库配置

### 方案1：使用Docker（推荐）
```bash
# 安装Docker Desktop for Mac
# 下载地址：https://www.docker.com/products/docker-desktop

# 启动MongoDB容器
docker run -d --name mongodb -p 27017:27017 mongo:latest

# 验证连接
docker exec -it mongodb mongo --eval "db.runCommand({ping: 1})"
```

### 方案2：使用Homebrew
```bash
# 安装Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装MongoDB
brew tap mongodb/brew
brew install mongodb-community

# 启动MongoDB
brew services start mongodb-community
```

### 方案3：直接下载安装
1. 访问 https://www.mongodb.com/try/download/community
2. 选择macOS版本下载
3. 按照安装向导完成安装

---

## ⚙️ 配置环境变量

### 1. 编辑.env文件
```bash
# 微信公众号配置
WECHAT_APPID=wx1234567890abcdef
WECHAT_SECRET=abcdef1234567890abcdef1234567890
WECHAT_TOKEN=your_random_token_string
WECHAT_ENCODING_AES_KEY=your_encoding_aes_key

# 百度AI配置
BAIDU_AI_API_KEY=your_baidu_api_key
BAIDU_AI_SECRET_KEY=your_baidu_secret_key

# 数据库配置
MONGO_URI=mongodb://localhost:27017/shinepod

# 服务器配置
WECHAT_SERVER_URL=https://your-domain.com
```

### 2. 测试配置
```bash
# 检查配置
npm run check-config

# 启动服务
npm run dev
```

---

## 🧪 测试真实功能

### 1. 测试微信消息接收
1. 在微信公众号后台发送测试消息
2. 检查服务器日志
3. 验证消息是否正确接收

### 2. 测试语音识别
1. 发送语音消息到公众号
2. 检查语音识别结果
3. 验证识别准确性

### 3. 测试WebSocket同步
1. 打开App模拟器
2. 发送微信消息
3. 验证实时同步功能

---

## 🚀 部署到公网

### 1. 购买云服务器
推荐服务商：
- 阿里云
- 腾讯云
- AWS
- 华为云

### 2. 配置域名和SSL
1. 购买域名
2. 申请SSL证书
3. 配置DNS解析

### 3. 部署应用
```bash
# 上传代码到服务器
# 安装依赖
npm install

# 配置环境变量
# 启动服务
npm start
```

---

## 📋 配置检查清单

- [ ] 微信公众号AppID已配置
- [ ] 微信公众号AppSecret已配置
- [ ] 微信公众号Token已配置
- [ ] 百度AI API Key已配置
- [ ] 百度AI Secret Key已配置
- [ ] MongoDB已安装并运行
- [ ] 环境变量已正确配置
- [ ] 服务器URL已配置
- [ ] SSL证书已配置
- [ ] 域名解析已配置

---

## 🔍 常见问题解决

### 1. 微信消息验证失败
- 检查Token是否与公众号后台一致
- 确认服务器URL可从外网访问
- 验证SSL证书是否有效

### 2. 百度AI识别失败
- 检查API Key和Secret Key是否正确
- 确认已开通语音识别服务
- 验证请求格式是否正确

### 3. MongoDB连接失败
- 检查MongoDB服务是否运行
- 验证连接字符串是否正确
- 确认端口27017是否开放

---

## 💡 重要提示

1. **不需要连接手机**：所有配置都在服务器端完成
2. **需要公网服务器**：微信公众号需要HTTPS公网地址
3. **需要域名**：建议使用域名而不是IP地址
4. **需要SSL证书**：微信公众号要求HTTPS协议

配置完成后，您的系统就可以接收真实的微信消息并进行语音识别了！
