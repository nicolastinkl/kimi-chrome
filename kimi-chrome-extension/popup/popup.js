// 弹出窗口逻辑
document.addEventListener('DOMContentLoaded', async () => {
  // 加载保存的设置
  await loadSettings();

  // 绑定事件
  document.getElementById('toggleApiKey').addEventListener('click', toggleApiKeyVisibility);
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  document.getElementById('analyzeBtn').addEventListener('click', analyzeCurrentPage);
  document.getElementById('openSidePanel').addEventListener('click', openSidePanel);
  document.getElementById('apiType').addEventListener('change', handleApiTypeChange);
  document.getElementById('checkCliStatus').addEventListener('click', checkCliServerStatus);
  
  // 初始检查 CLI 状态
  checkCliServerStatus();
});

// 加载设置
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(['kimiApiKey', 'kimiModel', 'kimiApiType']);
    
    // 设置 API 类型
    const apiType = result.kimiApiType || 'moonshot';
    document.getElementById('apiType').value = apiType;
    
    // 根据 API 类型更新界面
    updateUIForApiType(apiType);
    
    // 设置 API Key
    if (result.kimiApiKey) {
      document.getElementById('apiKey').value = result.kimiApiKey;
    }
    
    // 设置模型
    if (result.kimiModel) {
      document.getElementById('modelSelect').value = result.kimiModel;
    }
  } catch (error) {
    console.error('加载设置失败:', error);
  }
}

// 处理 API 类型切换
function handleApiTypeChange(e) {
  const apiType = e.target.value;
  updateUIForApiType(apiType);
}

// 根据 API 类型更新界面
function updateUIForApiType(apiType) {
  const moonshotSettings = document.getElementById('moonshotSettings');
  const kimiCodeSettings = document.getElementById('kimiCodeSettings');
  const apiTypeHint = document.getElementById('apiTypeHint');
  
  if (apiType === 'kimi-code') {
    // Kimi Code CLI 模式
    moonshotSettings.style.display = 'none';
    kimiCodeSettings.style.display = 'block';
    apiTypeHint.textContent = '通过本地 CLI 调用 Kimi Code（需要运行本地服务器）';
    checkCliServerStatus();
  } else {
    // Moonshot API 模式
    moonshotSettings.style.display = 'block';
    kimiCodeSettings.style.display = 'none';
    apiTypeHint.textContent = '标准 Kimi API，适合一般对话';
  }
}

// 检查 CLI 服务器状态
async function checkCliServerStatus() {
  const statusEl = document.getElementById('cliStatus');
  const dotEl = statusEl.querySelector('.status-dot');
  const textEl = statusEl.querySelector('.status-text');
  
  dotEl.className = 'status-dot unknown';
  textEl.textContent = '检查中...';
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'checkKimiCLIServer' });
    
    if (response.success && response.running) {
      dotEl.className = 'status-dot running';
      textEl.textContent = '服务器运行正常';
    } else {
      dotEl.className = 'status-dot stopped';
      textEl.textContent = '服务器未启动';
    }
  } catch (error) {
    dotEl.className = 'status-dot stopped';
    textEl.textContent = '检查失败';
    console.error('检查 CLI 状态失败:', error);
  }
}

// 切换 API Key 可见性
function toggleApiKeyVisibility() {
  const apiKeyInput = document.getElementById('apiKey');
  const toggleBtn = document.getElementById('toggleApiKey');
  
  if (apiKeyInput.type === 'password') {
    apiKeyInput.type = 'text';
    toggleBtn.textContent = '🙈';
  } else {
    apiKeyInput.type = 'password';
    toggleBtn.textContent = '👁️';
  }
}

// 保存设置
async function saveSettings() {
  const apiType = document.getElementById('apiType').value;
  const apiKey = document.getElementById('apiKey').value.trim();
  const model = document.getElementById('modelSelect').value;
  const statusEl = document.getElementById('settingsStatus');

  // 根据 API 类型验证
  if (apiType === 'moonshot' && !apiKey) {
    showStatus('请输入 Moonshot API Key', 'error');
    return;
  }

  try {
    await chrome.storage.local.set({
      kimiApiKey: apiKey,
      kimiApiType: apiType,
      kimiModel: model
    });
    showStatus('设置已保存！', 'success');
    console.log('设置已保存:', { apiType, model });
  } catch (error) {
    showStatus('保存失败: ' + error.message, 'error');
  }
}

// 显示状态信息
function showStatus(message, type) {
  const statusEl = document.getElementById('settingsStatus');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  
  setTimeout(() => {
    statusEl.textContent = '';
    statusEl.className = 'status';
  }, 3000);
}

// 分析当前页面
async function analyzeCurrentPage() {
  const apiType = document.getElementById('apiType').value;
  const apiKey = document.getElementById('apiKey').value.trim();
  
  // 验证设置
  if (apiType === 'moonshot' && !apiKey) {
    showStatus('请先设置 Moonshot API Key', 'error');
    return;
  }
  
  // 如果是 CLI 模式，检查服务器状态
  if (apiType === 'kimi-code') {
    const response = await chrome.runtime.sendMessage({ action: 'checkKimiCLIServer' });
    if (!response.success || !response.running) {
      showStatus('Kimi CLI 服务器未启动，请先运行 kimi_server.py', 'error');
      return;
    }
  }

  try {
    // 获取当前标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // 先打开侧边栏
    await chrome.sidePanel.open({ windowId: tab.windowId });
    
    // 向内容脚本发送消息，获取页面内容
    chrome.tabs.sendMessage(tab.id, { action: 'extractPageContent' }, async (response) => {
      if (chrome.runtime.lastError) {
        console.error('发送消息失败:', chrome.runtime.lastError);
        // 尝试注入内容脚本
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content_scripts/content.js']
        });
        // 重新发送消息
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { action: 'extractPageContent' });
        }, 100);
        return;
      }
      
      if (response && response.success) {
        // 转发到侧边栏进行分析
        chrome.runtime.sendMessage({
          action: 'startAnalysis',
          data: response.data
        });
      }
    });

    // 关闭弹出窗口
    window.close();
  } catch (error) {
    console.error('分析页面失败:', error);
    showStatus('分析失败: ' + error.message, 'error');
  }
}

// 打开侧边栏
async function openSidePanel() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.sidePanel.open({ windowId: tab.windowId });
    window.close();
  } catch (error) {
    console.error('打开侧边栏失败:', error);
  }
}
