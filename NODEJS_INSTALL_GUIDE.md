# Node.js 安装指南

## 方法1：使用官方安装包（推荐）

1. 双击项目目录中的 `nodejs.pkg` 文件
2. 按照安装向导完成安装
3. 安装完成后，重新打开终端

## 方法2：使用Homebrew安装

1. 首先安装Homebrew：
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

2. 安装Node.js：
```bash
brew install node
```

## 方法3：从官网下载

1. 访问 https://nodejs.org/
2. 下载LTS版本
3. 运行安装程序

## 验证安装

安装完成后，在终端中运行以下命令验证：

```bash
node --version
npm --version
```

如果显示版本号，说明安装成功。

## 安装项目依赖

安装Node.js后，在项目目录中运行：

```bash
npm install
```

这将安装package.json中列出的所有依赖包。
