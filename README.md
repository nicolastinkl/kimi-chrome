# Kimi AI Chrome Extension

一个功能强大的 Chrome 浏览器扩展，集成 Kimi AI 能力，支持网页内容分析、智能对话和本地 CLI 桥接。

## 功能特性

- 🤖 **双模式 AI 支持**
  - Moonshot Kimi API - 标准云端 API
  - Kimi Code API - 本地 CLI 桥接模式（无需 API Key）

- 📄 **网页智能分析**
  - 一键提取页面正文内容
  - 自动识别标题、描述、图片
  - 支持文章结构解析

- 💬 **侧边栏对话**
  - 沉浸式聊天体验
  - 支持图片上传和预览
  - 消息历史记录

- ⚡ **快捷操作**
  - 快速总结页面内容
  - 提取关键信息
  - 图片分析
  - 内容翻译

## 安装方法

### 1. 下载扩展

```bash
git clone https://github.com/yourusername/kimi-chrome.git
cd kimi-chrome/kimi-chrome-extension
```

### 2. 加载到 Chrome

1. 打开 Chrome 浏览器，访问 `chrome://extensions/`
2. 开启右上角的"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `kimi-chrome-extension` 文件夹

### 3. 配置 API（二选一）

#### 方式 A：Moonshot API（云端）
1. 访问 [Moonshot AI](https://platform.moonshot.cn/) 获取 API Key
2. 点击扩展图标 → 设置
3. 选择 "Moonshot Kimi API"
4. 输入 API Key 并保存

#### 方式 B：Kimi Code 本地模式（推荐）
1. 安装依赖：
   ```bash
   pip install flask flask-cors
   ```
2. 启动本地服务：
   ```bash
   python native-bridge/kimi_server.py
   ```
3. 扩展设置中选择 "Kimi Code API"
4. API Key 留空即可

## 使用方法

### 网页分析
1. 打开任意网页
2. 点击工具栏的 Kimi 扩展图标
3. 选择"分析当前页面"
4. 在侧边栏查看 AI 分析结果

### 快捷对话
- 点击扩展图标打开侧边栏
- 直接输入问题或选择快捷操作
- 支持拖拽上传图片进行分析

## 项目结构

```
kimi-chrome-extension/
├── manifest.json          # 扩展配置
├── background/            # 后台服务
│   └── background.js      # Service Worker
├── content_scripts/       # 内容脚本
│   ├── content.js         # 页面内容提取
│   └── content.css        # 页面样式
├── sidepanel/             # 侧边栏
│   ├── sidepanel.html     # 侧边栏界面
│   ├── sidepanel.css      # 侧边栏样式
│   └── sidepanel.js       # 侧边栏逻辑
├── popup/                 # 弹出窗口
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── native-bridge/         # 本地桥接服务
│   ├── kimi_server.py     # HTTP 服务
│   └── kimi_bridge.py     # CLI 桥接
└── icons/                 # 图标资源
```

## 技术栈

- **Frontend**: Vanilla JavaScript, CSS3
- **Backend**: Python, Flask
- **API**: Moonshot Kimi API / Local CLI Bridge
- **Platform**: Chrome Extension Manifest V3

## 开发计划

- [ ] 支持更多 AI 模型
- [ ] 历史对话持久化
- [ ] 自定义快捷指令
- [ ] 深色模式支持

## 许可证

MIT License

## 致谢

- [Moonshot AI](https://moonshot.cn/) - 提供 Kimi AI 能力
- [Kimi Code CLI](https://github.com/yourusername/kimi-cli) - 本地 AI 交互
