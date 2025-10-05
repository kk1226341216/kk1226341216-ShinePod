const fs = require('fs');
const path = require('path');

// 配置检查工具
class ConfigChecker {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.success = [];
  }

  // 检查环境变量文件
  checkEnvFile() {
    const envPath = path.join(__dirname, '.env');
    
    if (!fs.existsSync(envPath)) {
      this.errors.push('❌ .env 文件不存在');
      return false;
    }

    this.success.push('✅ .env 文件存在');
    
    // 读取.env文件内容
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    // 检查关键配置项
    const requiredConfigs = [
      'WECHAT_APPID',
      'WECHAT_SECRET', 
      'WECHAT_TOKEN',
      'MONGO_URI',
      'BAIDU_AI_API_KEY',
      'BAIDU_AI_SECRET_KEY'
    ];

    requiredConfigs.forEach(config => {
      if (envContent.includes(`${config}=YOUR_`) || envContent.includes(`${config}=your_`)) {
        this.warnings.push(`⚠️  ${config} 需要配置实际值`);
      } else if (envContent.includes(`${config}=`)) {
        this.success.push(`✅ ${config} 已配置`);
      } else {
        this.errors.push(`❌ ${config} 未配置`);
      }
    });

    return this.errors.length === 0;
  }

  // 检查package.json
  checkPackageJson() {
    const packagePath = path.join(__dirname, 'package.json');
    
    if (!fs.existsSync(packagePath)) {
      this.errors.push('❌ package.json 文件不存在');
      return false;
    }

    this.success.push('✅ package.json 文件存在');
    
    try {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      // 检查必要的依赖
      const requiredDeps = [
        'express',
        'mongoose', 
        'socket.io',
        'xml2js',
        'dotenv',
        'winston'
      ];

      requiredDeps.forEach(dep => {
        if (packageJson.dependencies && packageJson.dependencies[dep]) {
          this.success.push(`✅ 依赖 ${dep} 已配置`);
        } else {
          this.errors.push(`❌ 依赖 ${dep} 缺失`);
        }
      });

      return true;
    } catch (error) {
      this.errors.push('❌ package.json 格式错误');
      return false;
    }
  }

  // 检查目录结构
  checkDirectoryStructure() {
    const requiredDirs = [
      'server',
      'server/controllers',
      'server/models', 
      'server/routes',
      'server/services',
      'server/utils',
      'server/config'
    ];

    requiredDirs.forEach(dir => {
      const dirPath = path.join(__dirname, dir);
      if (fs.existsSync(dirPath)) {
        this.success.push(`✅ 目录 ${dir} 存在`);
      } else {
        this.errors.push(`❌ 目录 ${dir} 不存在`);
      }
    });
  }

  // 检查关键文件
  checkKeyFiles() {
    const requiredFiles = [
      'server/app.js',
      'server/config/config.js',
      'server/controllers/wechatController.js',
      'server/services/wechatService.js',
      'server/models/wechatMessageModel.js',
      'server/utils/webSocketUtils.js'
    ];

    requiredFiles.forEach(file => {
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        this.success.push(`✅ 文件 ${file} 存在`);
      } else {
        this.errors.push(`❌ 文件 ${file} 不存在`);
      }
    });
  }

  // 检查Node.js环境
  checkNodeEnvironment() {
    try {
      const nodeVersion = process.version;
      this.success.push(`✅ Node.js 版本: ${nodeVersion}`);
      
      // 检查版本是否满足要求
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      if (majorVersion >= 14) {
        this.success.push('✅ Node.js 版本满足要求 (>= 14.x)');
      } else {
        this.warnings.push('⚠️  Node.js 版本过低，建议升级到 14.x 或更高版本');
      }
      
      return true;
    } catch (error) {
      this.errors.push('❌ 无法检查Node.js环境');
      return false;
    }
  }

  // 运行所有检查
  runAllChecks() {
    console.log('🔍 开始配置检查...\n');
    
    this.checkNodeEnvironment();
    this.checkPackageJson();
    this.checkDirectoryStructure();
    this.checkKeyFiles();
    this.checkEnvFile();

    // 输出结果
    console.log('📊 检查结果:\n');
    
    if (this.success.length > 0) {
      console.log('✅ 成功项:');
      this.success.forEach(item => console.log(`   ${item}`));
      console.log('');
    }

    if (this.warnings.length > 0) {
      console.log('⚠️  警告项:');
      this.warnings.forEach(item => console.log(`   ${item}`));
      console.log('');
    }

    if (this.errors.length > 0) {
      console.log('❌ 错误项:');
      this.errors.forEach(item => console.log(`   ${item}`));
      console.log('');
    }

    // 总结
    const totalIssues = this.errors.length + this.warnings.length;
    if (totalIssues === 0) {
      console.log('🎉 所有检查通过！项目配置完整。');
      return true;
    } else {
      console.log(`📋 发现 ${totalIssues} 个问题需要解决:`);
      console.log(`   - ${this.errors.length} 个错误`);
      console.log(`   - ${this.warnings.length} 个警告`);
      return false;
    }
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const checker = new ConfigChecker();
  const success = checker.runAllChecks();
  
  if (!success) {
    console.log('\n💡 解决建议:');
    console.log('1. 安装Node.js: 参考 NODEJS_INSTALL_GUIDE.md');
    console.log('2. 安装依赖: npm install');
    console.log('3. 配置环境变量: 编辑 .env 文件');
    console.log('4. 启动MongoDB服务');
    console.log('5. 运行启动脚本: ./start.sh');
  }
}

module.exports = ConfigChecker;
