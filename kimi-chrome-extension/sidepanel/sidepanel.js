// 侧边栏逻辑
class KimiSidePanel {
  constructor() {
    this.messages = [];
    this.currentPageData = null;
    this.apiKey = '';
    this.apiType = 'moonshot'; // 'moonshot' 或 'kimi-code'
    this.model = 'moonshot-v1-8k';
    this.isAnalyzing = false;
    this.attachedImages = [];
    this.autoLoadComments = true; // 默认自动加载评论
    
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.bindEvents();
    this.setupMessageListener();
    this.updateApiInfo();
  }

  // 加载设置
  async loadSettings() {
    try {
      const result = await chrome.storage.local.get([
        'kimiApiKey', 
        'kimiModel', 
        'kimiApiType',
        'autoLoadComments'
      ]);
      
      this.apiKey = result.kimiApiKey || '';
      this.apiType = result.kimiApiType || 'moonshot';
      this.model = result.kimiModel || 'moonshot-v1-8k';
      this.autoLoadComments = result.autoLoadComments !== false; // 默认为 true
      
      // 更新设置面板
      document.getElementById('settingsApiKey').value = this.apiKey;
      document.getElementById('settingsApiType').value = this.apiType;
      document.getElementById('settingsModel').value = this.model;
      document.getElementById('autoLoadComments').checked = this.autoLoadComments;
      
      // 根据 API 类型更新界面
      this.updateSettingsUIForApiType(this.apiType);
      
      // 验证 API Key 格式
      this.validateApiKey();
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  }

  // 验证 API Key 格式
  validateApiKey() {
    if (!this.apiKey) return;
    
    if (this.apiType === 'kimi-code') {
      // Kimi Code API Key 应该以 sk-kimi- 开头
      if (!this.apiKey.startsWith('sk-kimi-')) {
        console.warn('警告: Kimi Code API Key 格式可能不正确，应该以 sk-kimi- 开头');
        console.log('当前 Key 前缀:', this.apiKey.substring(0, 20) + '...');
      }
    } else {
      // Moonshot API Key 通常以 sk- 开头
      if (!this.apiKey.startsWith('sk-')) {
        console.warn('警告: Moonshot API Key 格式可能不正确');
      }
    }
  }

  // 绑定事件
  bindEvents() {
    // 设置面板
    document.getElementById('settingsBtn').addEventListener('click', () => {
      const panel = document.getElementById('settingsPanel');
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('closeSettingsBtn').addEventListener('click', () => {
      document.getElementById('settingsPanel').style.display = 'none';
    });

    document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());
    document.getElementById('testConnectionBtn').addEventListener('click', () => this.testConnection());
    document.getElementById('toggleSettingsApiKey').addEventListener('click', this.toggleApiKeyVisibility);
    
    // API 类型切换
    document.getElementById('settingsApiType').addEventListener('change', (e) => {
      this.updateSettingsUIForApiType(e.target.value);
    });

    // 新对话
    document.getElementById('newChatBtn').addEventListener('click', () => this.startNewChat());

    // 快速操作按钮
    document.querySelectorAll('.quick-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const prompt = e.currentTarget.dataset.prompt;
        this.sendMessage(prompt);
      });
    });

    // 输入框
    const messageInput = document.getElementById('messageInput');
    messageInput.addEventListener('input', () => this.adjustTextareaHeight());
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // 发送按钮
    document.getElementById('sendBtn').addEventListener('click', () => this.sendMessage());

    // 图片附件
    document.getElementById('attachImageBtn').addEventListener('click', () => this.attachImage());
  }

  // 根据 API 类型更新设置界面
  updateSettingsUIForApiType(apiType) {
    const modelGroup = document.getElementById('settingsModelGroup');
    const kimiCodeModelGroup = document.getElementById('settingsKimiCodeModelGroup');
    const apiKeyLabel = document.getElementById('settingsApiKeyLabel');
    const apiKeyInput = document.getElementById('settingsApiKey');
    const apiHint = document.getElementById('settingsApiHint');
    
    if (apiType === 'kimi-code') {
      modelGroup.style.display = 'none';
      kimiCodeModelGroup.style.display = 'block';
      apiKeyLabel.textContent = 'Kimi Code API Key (可选)';
      apiKeyInput.placeholder = '可选：输入 API Key 或留空使用本地服务';
      apiHint.textContent = '使用本地 Kimi CLI 服务，API Key 可选';
    } else {
      modelGroup.style.display = 'block';
      kimiCodeModelGroup.style.display = 'none';
      apiKeyLabel.textContent = 'Moonshot API Key *';
      apiKeyInput.placeholder = '输入您的 API Key';
      apiHint.textContent = '标准 Kimi API，适合一般对话';
    }
  }

  // 更新底部 API 信息
  updateApiInfo() {
    const apiInfoEl = document.getElementById('apiInfo');
    if (this.apiType === 'kimi-code') {
      apiInfoEl.textContent = '● Kimi Code';
      apiInfoEl.style.color = '#f5576c';
    } else {
      apiInfoEl.textContent = `● ${this.model}`;
      apiInfoEl.style.color = '#667eea';
    }
  }

  // 设置消息监听
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'startAnalysis') {
        this.handlePageAnalysis(request.data);
        sendResponse({ success: true });
      }
    });
  }

  // 处理页面分析
  async handlePageAnalysis(data) {
    this.currentPageData = data;
    
    // 隐藏欢迎消息
    document.getElementById('welcomeMessage').style.display = 'none';
    
    // 显示页面信息卡片
    if (data.platform === 'xiaohongshu') {
      this.showXiaohongshuPageInfo(data.pageInfo, data.xiaohongshuData);
    } else {
      this.showPageInfo(data.pageInfo, data.mainContent, data.structure);
    }
    
    // 构建分析提示
    const analysisPrompt = this.buildAnalysisPrompt(data);
    
    // 发送分析请求
    await this.sendToKimi(analysisPrompt, true);
  }

  // 显示页面信息
  showPageInfo(pageInfo, mainContent, structure) {
    const card = document.getElementById('pageInfoCard');
    
    document.getElementById('pageFavicon').src = pageInfo.favicon || '../icons/icon32.png';
    document.getElementById('pageTitle').textContent = pageInfo.title;
    document.getElementById('pageUrl').textContent = new URL(pageInfo.url).hostname;
    
    const statsHtml = `
      <span>📝 ${mainContent.wordCount.toLocaleString()} 字</span>
      <span>🖼️ ${structure.imageCount} 张图片</span>
      <span>🔗 ${structure.linkCount} 个链接</span>
    `;
    document.getElementById('pageStats').innerHTML = statsHtml;
    
    card.style.display = 'block';
  }

  // 显示小红书页面信息
  showXiaohongshuPageInfo(pageInfo, xhsData) {
    const card = document.getElementById('pageInfoCard');
    
    document.getElementById('pageFavicon').src = xhsData.author?.avatar || '../icons/icon32.png';
    document.getElementById('pageTitle').textContent = xhsData.title || '小红书笔记';
    document.getElementById('pageUrl').textContent = `@${xhsData.author?.nickname || '未知用户'}`;
    
    const statsHtml = `
      <span>❤️ ${(xhsData.stats?.likes || 0).toLocaleString()}</span>
      <span>⭐ ${(xhsData.stats?.collects || 0).toLocaleString()}</span>
      <span>💬 ${(xhsData.stats?.comments || 0).toLocaleString()}</span>
      <span>📝 ${xhsData.comments?.length || 0} 条评论已提取</span>
    `;
    document.getElementById('pageStats').innerHTML = statsHtml;
    
    card.style.display = 'block';
  }

  // 构建分析提示
  buildAnalysisPrompt(data) {
    // 小红书数据处理
    if (data.platform === 'xiaohongshu' && data.xiaohongshuData) {
      return this.buildXiaohongshuPrompt(data.xiaohongshuData);
    }
    
    const { pageInfo, mainContent, images, structure } = data;
    
    let prompt = `请分析以下网页内容：\n\n`;
    prompt += `【页面标题】${pageInfo.title}\n`;
    prompt += `【页面URL】${pageInfo.url}\n`;
    
    if (pageInfo.description) {
      prompt += `【页面描述】${pageInfo.description}\n`;
    }
    
    prompt += `\n【主要内容】\n${mainContent.text.substring(0, 8000)}\n`;
    
    if (mainContent.headings.length > 0) {
      prompt += `\n【文章结构】\n`;
      mainContent.headings.forEach(h => {
        prompt += `${'  '.repeat(h.level - 1)}${h.text}\n`;
      });
    }
    
    if (images.length > 0) {
      prompt += `\n【页面图片】\n`;
      images.forEach((img, i) => {
        prompt += `${i + 1}. ${img.alt || '无描述'} (${img.width}x${img.height})\n`;
        if (img.context) {
          prompt += `   上下文: ${img.context.substring(0, 100)}\n`;
        }
      });
    }
    
    prompt += `\n请提供：\n`;
    prompt += `1. 页面内容的简要总结\n`;
    prompt += `2. 关键信息提取\n`;
    prompt += `3. 主要观点和结论\n`;
    prompt += `4. 如果有图片，分析图片与内容的关系\n`;
    
    return prompt;
  }

  // 构建小红书分析提示
  buildXiaohongshuPrompt(xhsData) {
    let prompt = `请分析以下小红书笔记及其评论数据：\n\n`;
    
    // 笔记信息
    prompt += `📱 **笔记信息**\n`;
    prompt += `- 标题：${xhsData.title || '无标题'}\n`;
    prompt += `- 作者：@${xhsData.author?.nickname || '未知'} (ID: ${xhsData.author?.userId || '未知'})\n`;
    prompt += `- 点赞：${(xhsData.stats?.likes || 0).toLocaleString()}\n`;
    prompt += `- 收藏：${(xhsData.stats?.collects || 0).toLocaleString()}\n`;
    prompt += `- 评论数：${(xhsData.stats?.comments || 0).toLocaleString()}\n\n`;
    
    // 笔记内容
    if (xhsData.content) {
      prompt += `📝 **笔记内容**\n${xhsData.content.substring(0, 3000)}\n\n`;
    }
    
    // 媒体资源
    if (xhsData.media?.images?.length > 0) {
      prompt += `🖼️ **图片资源** (${xhsData.media.images.length}张)\n`;
      xhsData.media.images.slice(0, 5).forEach((img, i) => {
        prompt += `${i + 1}. ${img}\n`;
      });
      prompt += `\n`;
    }
    
    if (xhsData.media?.video) {
      prompt += `🎥 **视频资源**：${xhsData.media.video}\n\n`;
    }
    
    // 评论数据
    if (xhsData.comments && xhsData.comments.length > 0) {
      prompt += `💬 **评论分析** (共${xhsData.comments.length}条)\n\n`;
      
      // 按点赞数排序，取前20条热门评论
      const sortedComments = [...xhsData.comments]
        .sort((a, b) => (b.likes || 0) - (a.likes || 0))
        .slice(0, 20);
      
      sortedComments.forEach((comment, i) => {
        prompt += `**评论 ${i + 1}**\n`;
        prompt += `- 用户：@${comment.author?.nickname || '匿名'}\n`;
        prompt += `- 内容：${comment.content}\n`;
        prompt += `- 点赞：${(comment.likes || 0).toLocaleString()}\n`;
        if (comment.time) {
          prompt += `- 时间：${comment.time}\n`;
        }
        
        // 回复
        if (comment.replies && comment.replies.length > 0) {
          prompt += `- 回复：${comment.replies.length}条\n`;
          comment.replies.slice(0, 3).forEach((reply, j) => {
            prompt += `  ↳ @${reply.author?.nickname || '匿名'}: ${reply.content.substring(0, 100)}\n`;
          });
        }
        prompt += `\n`;
      });
      
      prompt += `\n📊 **请提供以下分析**：\n`;
      prompt += `1. 笔记内容的核心主题和要点\n`;
      prompt += `2. 评论情感分析（正面/负面/中性比例）\n`;
      prompt += `3. 用户关注的热点话题和疑问\n`;
      prompt += `4. 有价值的用户反馈和建议\n`;
      prompt += `5. 互动数据分析（哪些评论最受欢迎）\n`;
      prompt += `6. 针对笔记内容的优化建议\n`;
    } else {
      prompt += `\n📊 **请提供以下分析**：\n`;
      prompt += `1. 笔记内容的核心主题和要点\n`;
      prompt += `2. 内容质量和表达风格评价\n`;
      prompt += `3. 潜在的受众群体分析\n`;
      prompt += `4. 内容优化建议\n`;
    }
    
    return prompt;
  }

  // 保存设置
  async saveSettings() {
    const apiKey = document.getElementById('settingsApiKey').value.trim();
    const apiType = document.getElementById('settingsApiType').value;
    const model = document.getElementById('settingsModel').value;
    const autoLoadComments = document.getElementById('autoLoadComments').checked;
    const messageEl = document.getElementById('settingsMessage');

    // 只有非 kimi-code 模式才强制要求 API Key
    if (apiType !== 'kimi-code' && !apiKey) {
      this.showSettingsMessage('请输入 API Key', 'error');
      return;
    }

    // 验证 API Key 格式 (kimi-code 模式下如果提供了 API Key，则验证格式)
    if (apiType === 'kimi-code' && apiKey && !apiKey.startsWith('sk-kimi-')) {
      this.showSettingsMessage('Kimi Code API Key 应该以 sk-kimi- 开头，请检查', 'error');
      return;
    }

    try {
      await chrome.storage.local.set({
        kimiApiKey: apiKey,
        kimiApiType: apiType,
        kimiModel: model,
        autoLoadComments: autoLoadComments
      });
      
      this.apiKey = apiKey;
      this.apiType = apiType;
      this.model = model;
      this.autoLoadComments = autoLoadComments;
      
      this.updateApiInfo();
      this.showSettingsMessage('设置已保存！', 'success');
      
      setTimeout(() => {
        document.getElementById('settingsPanel').style.display = 'none';
        messageEl.textContent = '';
      }, 1500);
    } catch (error) {
      this.showSettingsMessage('保存失败: ' + error.message, 'error');
    }
  }

  // 显示设置消息
  showSettingsMessage(message, type) {
    const el = document.getElementById('settingsMessage');
    el.textContent = message;
    el.className = `settings-message ${type}`;
  }

  // 测试连接
  async testConnection() {
    const apiKey = document.getElementById('settingsApiKey').value.trim();
    const apiType = document.getElementById('settingsApiType').value;
    const model = document.getElementById('settingsModel').value;
    
    // kimi-code 模式下 API Key 是可选的
    if (apiType !== 'kimi-code' && !apiKey) {
      this.showSettingsMessage('请先输入 API Key', 'error');
      return;
    }

    this.showSettingsMessage('正在测试连接...', '');
    
    try {
      // 构建测试消息
      const testMessages = [
        { role: 'system', content: '你是一个测试助手' },
        { role: 'user', content: '你好，这是一个测试消息，请回复"连接成功"' }
      ];
      
      // 确定模型
      let requestModel = model;
      if (apiType === 'kimi-code') {
        requestModel = 'kimi-for-coding';
      }
      
      console.log('Testing connection:', {
        apiType,
        model: requestModel,
        apiKeyPrefix: apiKey.substring(0, 15) + '...'
      });
      
      // 调用 API
      const response = await chrome.runtime.sendMessage({
        action: 'fetchKimiAPI',
        data: {
          apiKey: apiKey,
          apiType: apiType,
          model: requestModel,
          messages: testMessages
        }
      });

      if (response.success) {
        this.showSettingsMessage('✅ 连接成功！API 工作正常', 'success');
        console.log('Test response:', response.data);
      } else {
        throw new Error(response.error || '连接失败');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      
      let errorMsg = error.message;
      if (errorMsg.includes('Invalid Authentication') || errorMsg.includes('401')) {
        errorMsg = '❌ 认证失败\n\n';
        errorMsg += '可能的原因：\n';
        errorMsg += '1. API Key 不正确或已过期\n';
        errorMsg += '2. API Key 格式错误\n';
        if (apiType === 'kimi-code') {
          errorMsg += '   Kimi Code API Key 应以 sk-kimi- 开头\n';
          errorMsg += '   当前端点: api.kimi.com/v1\n';
        }
        errorMsg += '3. 账户余额不足或被限制\n';
        errorMsg += '4. Kimi Code 会员未激活\n';
        errorMsg += '\n请检查控制台日志获取更多信息。';
      }
      
      this.showSettingsMessage(errorMsg, 'error');
    }
  }

  // 切换 API Key 可见性
  toggleApiKeyVisibility() {
    const input = document.getElementById('settingsApiKey');
    const btn = document.getElementById('toggleSettingsApiKey');
    
    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = '🙈';
    } else {
      input.type = 'password';
      btn.textContent = '👁️';
    }
  }

  // 开始新对话
  startNewChat() {
    this.messages = [];
    this.currentPageData = null;
    this.attachedImages = [];
    
    const container = document.getElementById('messagesContainer');
    container.innerHTML = `
      <div class="welcome-message">
        <div class="welcome-icon">👋</div>
        <h2>欢迎使用 Kimi AI 助手</h2>
        <p>我可以帮你分析网页内容、提取关键信息、总结文章要点，或者回答你的任何问题。</p>
        <div class="quick-actions">
          <button class="quick-action-btn" data-prompt="请总结这个页面的主要内容">
            📝 总结页面
          </button>
          <button class="quick-action-btn" data-prompt="请提取这个页面的关键信息">
            🔍 提取关键信息
          </button>
          <button class="quick-action-btn" data-prompt="请分析这个页面的图片">
            🖼️ 分析图片
          </button>
          <button class="quick-action-btn" data-prompt="请翻译这个页面的内容">
            🌐 翻译内容
          </button>
        </div>
      </div>
    `;
    
    // 重新绑定快速操作按钮事件
    document.querySelectorAll('.quick-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const prompt = e.currentTarget.dataset.prompt;
        if (this.currentPageData) {
          this.sendMessage(prompt);
        } else {
          this.addMessage('system', '请先打开一个网页并点击分析按钮，或直接在下方输入您的问题。');
        }
      });
    });
    
    document.getElementById('pageInfoCard').style.display = 'none';
  }

  // 调整文本框高度
  adjustTextareaHeight() {
    const textarea = document.getElementById('messageInput');
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    
    // 更新发送按钮状态
    const sendBtn = document.getElementById('sendBtn');
    sendBtn.disabled = textarea.value.trim().length === 0 && this.attachedImages.length === 0;
  }

  // 添加图片附件
  async attachImage() {
    // 创建文件输入
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    
    input.onchange = async (e) => {
      const files = Array.from(e.target.files);
      
      for (const file of files) {
        if (this.attachedImages.length >= 5) {
          alert('最多只能附加 5 张图片');
          break;
        }
        
        try {
          const base64 = await this.fileToBase64(file);
          this.attachedImages.push({
            name: file.name,
            base64: base64,
            type: file.type
          });
        } catch (error) {
          console.error('读取图片失败:', error);
        }
      }
      
      this.updateImagePreview();
      this.adjustTextareaHeight();
    };
    
    input.click();
  }

  // 文件转 base64
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // 更新图片预览
  updateImagePreview() {
    // 移除旧的预览
    const oldPreview = document.querySelector('.image-preview');
    if (oldPreview) {
      oldPreview.remove();
    }
    
    if (this.attachedImages.length === 0) {
      return;
    }
    
    // 创建新的预览
    const preview = document.createElement('div');
    preview.className = 'image-preview';
    
    this.attachedImages.forEach((img, index) => {
      const item = document.createElement('div');
      item.className = 'image-preview-item';
      item.innerHTML = `
        <img src="${img.base64}" alt="${img.name}">
        <button class="image-preview-remove" data-index="${index}">×</button>
      `;
      preview.appendChild(item);
    });
    
    // 插入到输入框上方
    const inputArea = document.querySelector('.input-area');
    inputArea.insertBefore(preview, inputArea.firstChild);
    
    // 绑定删除事件
    preview.querySelectorAll('.image-preview-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.attachedImages.splice(index, 1);
        this.updateImagePreview();
      });
    });
  }

  // 发送消息
  async sendMessage(text = null) {
    // 只有非 kimi-code 模式才需要 API Key
    if (this.apiType !== 'kimi-code' && !this.apiKey) {
      this.addMessage('system', '请先设置 API Key。点击右上角的 ⚙️ 按钮进行设置。');
      document.getElementById('settingsPanel').style.display = 'block';
      return;
    }

    const messageInput = document.getElementById('messageInput');
    const messageText = text || messageInput.value.trim();
    
    if (!messageText && this.attachedImages.length === 0) {
      return;
    }

    // 添加用户消息
    this.addMessage('user', messageText, this.attachedImages);
    
    // 清空输入
    messageInput.value = '';
    messageInput.style.height = 'auto';
    this.attachedImages = [];
    this.updateImagePreview();
    
    // 发送到 Kimi
    await this.sendToKimi(messageText);
  }

  // 发送到 Kimi API
  async sendToKimi(messageText, isAnalysis = false) {
    if (this.isAnalyzing) {
      return;
    }

    this.isAnalyzing = true;
    this.updateConnectionStatus('thinking');
    
    // 显示加载动画
    const loadingId = this.showLoading();

    try {
      // 构建消息历史
      const messages = this.buildMessages(messageText, isAnalysis);
      
      // 确定模型
      let model = this.model;
      if (this.apiType === 'kimi-code') {
        model = 'kimi-for-coding';
      }
      
      console.log('Sending request:', {
        apiType: this.apiType,
        model: model,
        messageCount: messages.length,
        apiKeyPrefix: this.apiKey.substring(0, 10) + '...'
      });
      
      // 调用 API
      const response = await chrome.runtime.sendMessage({
        action: 'fetchKimiAPI',
        data: {
          apiKey: this.apiKey,
          apiType: this.apiType,
          model: model,
          messages: messages
        }
      });

      // 移除加载动画
      this.removeLoading(loadingId);

      if (response.success) {
        const assistantMessage = response.data.choices[0].message.content;
        this.addMessage('assistant', assistantMessage);
        this.updateConnectionStatus('connected');
      } else {
        throw new Error(response.error || '请求失败');
      }
    } catch (error) {
      this.removeLoading(loadingId);
      
      // 提供更详细的错误信息
      let errorMsg = error.message;
      if (errorMsg.includes('Invalid Authentication') || errorMsg.includes('401')) {
        errorMsg += '\n\n可能的原因：\n';
        errorMsg += '1. API Key 不正确或已过期\n';
        errorMsg += '2. API Key 格式错误\n';
        if (this.apiType === 'kimi-code') {
          errorMsg += '   Kimi Code API Key 应以 sk-kimi- 开头\n';
          errorMsg += '   当前使用端点: api.kimi.com/v1\n';
        }
        errorMsg += '3. 账户余额不足\n';
        errorMsg += '4. Kimi Code 会员未激活\n';
        errorMsg += '\n请检查设置中的 API Key 是否正确。';
      }
      
      this.addMessage('system', `错误: ${errorMsg}`);
      this.updateConnectionStatus('error');
      console.error('Kimi API 错误:', error);
    } finally {
      this.isAnalyzing = false;
    }
  }

  // 构建消息
  buildMessages(currentMessage, isAnalysis) {
    const messages = [];
    
    // 系统提示
    const systemPrompt = this.apiType === 'kimi-code' 
      ? '你是一个专业的网页内容分析助手，基于 Kimi Code 模型。你擅长分析网页内容、提取关键信息、总结文章要点，并回答用户的各种问题。请用中文回答。'
      : '你是一个专业的网页内容分析助手。你可以分析网页内容、提取关键信息、总结文章要点，并回答用户的各种问题。请用中文回答。';
    
    messages.push({
      role: 'system',
      content: systemPrompt
    });
    
    // 添加历史消息（保留最近 10 条）
    const recentMessages = this.messages.slice(-10);
    for (const msg of recentMessages) {
      if (msg.role !== 'system') {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }
    
    // 添加当前消息
    if (currentMessage) {
      messages.push({
        role: 'user',
        content: currentMessage
      });
    }
    
    return messages;
  }

  // 添加消息到界面
  addMessage(role, content, images = []) {
    const container = document.getElementById('messagesContainer');
    
    // 隐藏欢迎消息
    const welcomeMessage = document.getElementById('welcomeMessage');
    if (welcomeMessage) {
      welcomeMessage.style.display = 'none';
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    let avatar = '';
    if (role === 'user') {
      avatar = '👤';
    } else if (role === 'assistant') {
      avatar = this.apiType === 'kimi-code' ? '👨‍💻' : '🤖';
    } else {
      avatar = '⚠️';
    }
    
    // 处理 Markdown 格式
    let formattedContent = this.formatMarkdown(content);
    
    // 添加图片
    let imagesHtml = '';
    if (images && images.length > 0) {
      imagesHtml = '<div class="message-images">';
      images.forEach(img => {
        imagesHtml += `<img src="${img.base64}" alt="${img.name}" style="max-width: 200px; border-radius: 8px; margin-top: 8px;">`;
      });
      imagesHtml += '</div>';
    }
    
    messageDiv.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-content">
        ${formattedContent}
        ${imagesHtml}
      </div>
    `;
    
    container.appendChild(messageDiv);
    
    // 添加代码复制按钮
    this.addCodeCopyButtons(messageDiv);
    
    // 处理任务列表交互
    this.initTaskListInteraction(messageDiv);
    
    // 保存到历史
    this.messages.push({
      role: role,
      content: content,
      timestamp: Date.now()
    });
    
    // 滚动到底部
    this.scrollToBottom();
  }

  // 初始化 Marked 和代码高亮
  initMarked() {
    // 配置 marked 选项
    marked.setOptions({
      gfm: true,              // 启用 GitHub Flavored Markdown
      tables: true,           // 启用表格支持
      breaks: true,           // 启用换行符转换
      pedantic: false,        // 不启用严格模式
      sanitize: false,        // 使用 DOMPurify 进行净化，不使用 marked 的内置净化
      smartLists: true,       // 启用智能列表
      smartypants: true,      // 启用智能标点
      xhtml: false            // 不强制 XHTML 自闭合标签
    });

    // 配置代码高亮
    marked.setOptions({
      highlight: function(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        try {
          return hljs.highlight(code, { language }).value;
        } catch (e) {
          return hljs.highlightAuto(code).value;
        }
      }
    });
  }

  // 格式化 Markdown
  formatMarkdown(text) {
    if (!text) return '';

    // 确保 marked 已初始化
    if (typeof marked === 'undefined') {
      console.warn('marked.js not loaded, falling back to plain text');
      return this.escapeHtml(text).replace(/\n/g, '<br>');
    }

    // 初始化 marked（首次调用时）
    if (!this._markedInitialized) {
      this.initMarked();
      this._markedInitialized = true;
    }

    try {
      // 使用 marked.parse 渲染 Markdown
      let html = marked.parse(text);

      // 使用 DOMPurify 进行 XSS 防护
      if (typeof DOMPurify !== 'undefined') {
        html = DOMPurify.sanitize(html, {
          ALLOWED_TAGS: [
            'p', 'br', 'hr', 'div', 'span',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'strong', 'b', 'em', 'i', 'u', 'strike', 'del', 'mark',
            'code', 'pre', 'kbd', 'samp',
            'a', 'img',
            'ul', 'ol', 'li', 'dl', 'dt', 'dd',
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'blockquote', 'q', 'cite',
            'sup', 'sub', 'small', 'big',
            'input' // 用于任务列表复选框
          ],
          ALLOWED_ATTR: [
            'href', 'title', 'target', 'rel',
            'src', 'alt', 'width', 'height',
            'class', 'id', 'name',
            'checked', 'disabled', 'type' // 用于任务列表复选框
          ],
          ALLOW_DATA_ATTR: false,
          SANITIZE_DOM: true
        });
      }

      return html;
    } catch (error) {
      console.error('Markdown parsing error:', error);
      // 发生错误时返回转义后的纯文本
      return this.escapeHtml(text).replace(/\n/g, '<br>');
    }
  }

  // HTML 转义辅助函数
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 添加代码复制按钮
  addCodeCopyButtons(messageDiv) {
    const codeBlocks = messageDiv.querySelectorAll('pre code');
    codeBlocks.forEach(codeBlock => {
      const pre = codeBlock.parentElement;
      
      // 检测语言
      const language = codeBlock.className.match(/language-(\w+)/)?.[1] || 
                       codeBlock.className.match(/hljs-(\w+)/)?.[1] || '';
      if (language) {
        pre.setAttribute('data-language', language);
      }
      
      // 创建复制按钮
      const copyBtn = document.createElement('button');
      copyBtn.className = 'code-copy-btn';
      copyBtn.textContent = '复制';
      copyBtn.addEventListener('click', () => {
        const code = codeBlock.textContent;
        navigator.clipboard.writeText(code).then(() => {
          copyBtn.textContent = '已复制!';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.textContent = '复制';
            copyBtn.classList.remove('copied');
          }, 2000);
        }).catch(err => {
          console.error('复制失败:', err);
          copyBtn.textContent = '复制失败';
          setTimeout(() => {
            copyBtn.textContent = '复制';
          }, 2000);
        });
      });
      
      pre.appendChild(copyBtn);
    });
  }

  // 初始化任务列表交互
  initTaskListInteraction(messageDiv) {
    const checkboxes = messageDiv.querySelectorAll('.task-list-item input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const listItem = e.target.closest('.task-list-item');
        if (e.target.checked) {
          listItem.classList.add('checked');
        } else {
          listItem.classList.remove('checked');
        }
      });
    });
  }

  // 显示加载动画
  showLoading() {
    const container = document.getElementById('messagesContainer');
    const id = 'loading-' + Date.now();
    
    const loadingDiv = document.createElement('div');
    loadingDiv.id = id;
    loadingDiv.className = 'message assistant loading';
    loadingDiv.innerHTML = `
      <div class="message-avatar">${this.apiType === 'kimi-code' ? '👨‍💻' : '🤖'}</div>
      <div class="message-content">
        <div class="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    `;
    
    container.appendChild(loadingDiv);
    this.scrollToBottom();
    
    return id;
  }

  // 移除加载动画
  removeLoading(id) {
    const loadingDiv = document.getElementById(id);
    if (loadingDiv) {
      loadingDiv.remove();
    }
  }

  // 滚动到底部
  scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    container.scrollTop = container.scrollHeight;
  }

  // 更新连接状态
  updateConnectionStatus(status) {
    const statusEl = document.getElementById('connectionStatus');
    
    switch (status) {
      case 'connected':
        statusEl.textContent = '● 已连接';
        statusEl.className = 'header-status connected';
        break;
      case 'thinking':
        statusEl.textContent = '● 思考中...';
        statusEl.className = 'header-status';
        break;
      case 'error':
        statusEl.textContent = '● 连接错误';
        statusEl.className = 'header-status disconnected';
        break;
      default:
        statusEl.textContent = '● 就绪';
        statusEl.className = 'header-status';
    }
  }
}

// 初始化
const sidePanel = new KimiSidePanel();
