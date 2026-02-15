# 🚀 Kimi AI Chrome 插件

一个功能强大的 Chrome 浏览器插件，同时支持 **Moonshot Kimi API** 和 **Kimi Code API**，可以一键分析网页内容、提取关键信息、总结文章要点，并支持实时对话。

## ✨ 功能特性

### 🔐 双 API 支持
- ✅ **Moonshot Kimi API** - 标准 Kimi API，适合一般对话和内容分析
- ✅ **Kimi Code API** - 专为编程优化的 API，支持 256K 超长上下文
- 一键切换 API 类型
- 本地安全存储 API Key

### 📄 页面内容抓取
- 智能提取网页主要内容
- 自动识别文章正文、标题、描述
- 提取页面结构信息（标题、段落、链接等）
- 支持多种网页类型的内容解析

### 🖼️ 图片抓取与分析
- 自动提取页面中的图片
- 智能识别主图和内容图片
- 获取图片上下文信息
- 支持图片与文本关联分析

### 💬 实时对话
- 侧边栏对话界面
- 支持连续对话上下文
- Markdown 格式渲染
- 代码高亮显示
- 支持图片附件上传

### 🎯 快速操作
- 一键总结页面内容
- 一键提取关键信息
- 一键分析页面图片
- 一键翻译页面内容

## 📦 安装方法

### 方式一：开发者模式加载

1. 下载或克隆本项目到本地
2. 打开 Chrome 浏览器，进入 `chrome://extensions/`
3. 开启右上角的「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择 `kimi-chrome-extension` 文件夹

### 方式二：Chrome 网上应用店（待发布）

## 🔧 配置说明

### 获取 Moonshot Kimi API Key

1. 访问 [Moonshot AI 开放平台](https://platform.moonshot.cn/)
2. 注册并登录账号
3. 进入「API Key 管理」页面
4. 创建新的 API Key

### 获取 Kimi Code API Key

1. 访问 [Kimi Code 控制台](https://www.kimi.com/code/console)
2. 登录您的 Kimi 账号
3. 进入「API Keys」页面
4. 点击创建新的 API Key

### 配置插件

1. 点击浏览器工具栏的 Kimi 图标
2. 选择 API 类型：
   - **Moonshot Kimi API** - 适合一般对话和内容分析
   - **Kimi Code API** - 适合编程相关任务，支持 256K 上下文
3. 输入对应的 API Key
4. 如果选择 Moonshot API，还可以选择模型（8k/32k/128k）
5. 点击「保存设置」

## 🚀 使用方法

### 一键分析当前页面

1. 打开任意网页
2. 点击浏览器工具栏的 Kimi 图标
3. 点击「一键分析当前页面」按钮
4. 侧边栏会自动打开并显示分析结果

### 使用浮动按钮

页面右下角会出现 Kimi 浮动按钮，点击即可快速分析当前页面。

### 实时对话

1. 打开侧边栏（点击 Kimi 图标 → 「打开对话面板」）
2. 在输入框中输入问题
3. 按 Enter 发送消息
4. Kimi AI 会基于当前页面内容回答问题

### 快速操作

在侧边栏欢迎界面，点击以下快捷按钮：
- 📝 总结页面 - 自动生成页面内容摘要
- 🔍 提取关键信息 - 提取重要数据和观点
- 🖼️ 分析图片 - 分析页面中的图片内容
- 🌐 翻译内容 - 将页面内容翻译成中文

### 添加图片附件

1. 点击输入框旁的 📷 按钮
2. 选择要上传的图片（最多 5 张）
3. 输入相关问题
4. 发送消息，Kimi 会分析图片内容

## 🔄 API 类型对比

| 特性 | Moonshot Kimi API | Kimi Code API |
|------|-------------------|---------------|
| **适用场景** | 一般对话、内容分析 | 编程、代码分析 |
| **上下文长度** | 8k / 32k / 128k | 256K |
| **模型选择** | 多种可选 | kimi-for-coding |
| **API 端点** | api.moonshot.cn | api.kimi.com |
| **获取地址** | platform.moonshot.cn | kimi.com/code/console |

## 🛠️ 技术架构

```
kimi-chrome-extension/
├── manifest.json          # 插件配置
├── background/            # 后台服务
│   └── background.js      # Service Worker - 处理双 API 请求
├── content_scripts/       # 内容脚本
│   ├── content.js         # 页面内容提取
│   └── content.css        # 内容脚本样式
├── popup/                 # 弹出窗口
│   ├── popup.html         # 弹出窗口界面
│   ├── popup.css          # 弹出窗口样式
│   └── popup.js           # 弹出窗口逻辑 - API 类型选择
├── sidepanel/             # 侧边栏
│   ├── sidepanel.html     # 侧边栏对话界面
│   ├── sidepanel.css      # 侧边栏样式
│   └── sidepanel.js       # 侧边栏逻辑 - 双 API 支持
├── icons/                 # 图标资源
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## 🔒 隐私说明

- API Key 使用 Chrome 本地存储加密保存
- 页面内容仅在本地处理，不会上传到第三方服务器
- 仅与 Kimi API 进行必要的通信
- 支持两种 API 类型，数据相互隔离

## 📝 更新日志

### v1.1.0
- ✨ 新增 Kimi Code API 支持
- ✨ 支持一键切换 API 类型
- ✨ 显示当前使用的 API 类型
- 🔧 优化设置界面

### v1.0.0
- ✨ 初始版本发布
- 🔐 支持 Kimi API Key 配置
- 📄 智能页面内容提取
- 🖼️ 图片抓取与分析
- 💬 实时对话功能
- 🎯 快速操作按钮

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

- [Moonshot AI](https://www.moonshot.cn/) - 提供 Moonshot Kimi API
- [Kimi Code](https://www.kimi.com/code) - 提供 Kimi Code API
- [Chrome Extensions](https://developer.chrome.com/docs/extensions/) - 扩展开发文档
