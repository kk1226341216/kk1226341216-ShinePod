const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);

// 配置静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 配置body-parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 初始化Socket.io
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// 文件数据库
class MobileAppDatabase {
  constructor() {
    this.dataDir = path.join(__dirname, 'data');
    this.messagesFile = path.join(this.dataDir, 'mobile_messages.json');
    this.usersFile = path.join(this.dataDir, 'mobile_users.json');
    this.recordsFile = path.join(this.dataDir, 'mobile_records.json');
    this.statsFile = path.join(this.dataDir, 'mobile_stats.json');
    this.remindersFile = path.join(this.dataDir, 'mobile_reminders.json');
    
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    this.initDataFiles();
  }
  
  initDataFiles() {
    const files = [
      { file: this.messagesFile, data: [] },
      { file: this.usersFile, data: [] },
      { file: this.recordsFile, data: [] },
      { file: this.statsFile, data: this.getDefaultStats() },
      { file: this.remindersFile, data: [] }
    ];
    
    files.forEach(({ file, data }) => {
      if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
      }
    });
  }
  
  getDefaultStats() {
    return {
      totalMessages: 0,
      totalRecords: 0,
      totalReminders: 0,
      weeklyActivity: Array.from({length: 7}, (_, i) => ({
        day: i,
        messages: 0,
        records: 0
      })),
      monthlyStats: {
        messages: 0,
        records: 0,
        reminders: 0
      }
    };
  }
  
  readData(file) {
    try {
      const data = fs.readFileSync(file, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }
  
  saveData(file, data) {
    try {
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      return false;
    }
  }
  
  addMessage(message) {
    const messages = this.readData(this.messagesFile);
    const newMessage = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      ...message,
      timestamp: new Date(),
      type: message.type || 'text'
    };
    messages.push(newMessage);
    this.saveData(this.messagesFile, messages);
    return newMessage;
  }
  
  addRecord(record) {
    const records = this.readData(this.recordsFile);
    const newRecord = {
      id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      ...record,
      timestamp: new Date(),
      type: record.type || 'text'
    };
    records.push(newRecord);
    this.saveData(this.recordsFile, records);
    
    // 更新统计数据
    this.updateStats();
    
    return newRecord;
  }
  
  updateStats() {
    const records = this.readData(this.recordsFile);
    const reminders = this.readData(this.remindersFile);
    const stats = this.readData(this.statsFile);
    
    stats.totalRecords = records.length;
    stats.totalReminders = reminders.length;
    
    // 更新周统计数据
    const now = new Date();
    const dayOfWeek = now.getDay();
    if (stats.weeklyActivity[dayOfWeek]) {
      stats.weeklyActivity[dayOfWeek].records = records.filter(record => {
        const recordDate = new Date(record.timestamp);
        return recordDate.getDay() === dayOfWeek;
      }).length;
    }
    
    this.saveData(this.statsFile, stats);
  }
  
  addReminder(reminder) {
    const reminders = this.readData(this.remindersFile);
    const newReminder = {
      id: 'rem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      ...reminder,
      createdAt: new Date(),
      isActive: true
    };
    reminders.push(newReminder);
    this.saveData(this.remindersFile, reminders);
    return newReminder;
  }
}

const db = new MobileAppDatabase();

// WebSocket连接处理
io.on('connection', (socket) => {
  console.log('📱 移动端App连接:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('📱 移动端App断开:', socket.id);
  });
  
  socket.on('send_message', (data) => {
    const message = db.addMessage(data);
    io.emit('new_message', message);
  });
  
  socket.on('add_record', (data) => {
    const record = db.addRecord(data);
    io.emit('new_record', record);
  });
  
  socket.on('add_reminder', (data) => {
    const reminder = db.addReminder(data);
    io.emit('new_reminder', reminder);
  });
});

// API路由
app.get('/api/messages', (req, res) => {
  const messages = db.readData(db.messagesFile);
  res.json({ success: true, data: messages });
});

app.get('/api/records', (req, res) => {
  const records = db.readData(db.recordsFile);
  res.json({ success: true, data: records });
});

// 添加记录
app.post('/api/records', (req, res) => {
  try {
    const records = db.readData(db.recordsFile);
    const newRecord = {
      id: Date.now().toString(),
      title: req.body.title || '新记录',
      content: req.body.content || '',
      timestamp: req.body.timestamp || Date.now(),
      location: req.body.location || '',
      type: req.body.type || 'voice'
    };
    
    records.unshift(newRecord); // 添加到开头，保持最新记录在前
    db.saveData(db.recordsFile, records);
    
    res.json({ success: true, data: newRecord });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/stats', (req, res) => {
  const stats = db.readData(db.statsFile);
  res.json({ success: true, data: stats });
});

app.get('/api/reminders', (req, res) => {
  const reminders = db.readData(db.remindersFile);
  res.json({ success: true, data: reminders });
});

// 主页面路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'mobile-app-modern.html'));
});

const PORT = 3002;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log('📱 拾光豆现代化移动端App启动成功！');
  console.log(`🌐 访问地址: http://${HOST}:${PORT}`);
  console.log(`🔌 WebSocket地址: ws://${HOST}:${PORT}`);
  console.log(`📱 移动端界面: http://${HOST}:${PORT}`);
});

module.exports = app;
