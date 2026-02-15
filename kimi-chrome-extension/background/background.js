// 后台服务工作者
chrome.runtime.onInstalled.addListener(() => {
  console.log('Kimi AI 插件已安装');
});

// 监听来自内容脚本或弹出窗口的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openSidePanel') {
    // 打开侧边栏
    chrome.sidePanel.open({ windowId: sender.tab.windowId });
    sendResponse({ success: true });
  } else if (request.action === 'analyzePage') {
    // 转发页面分析请求到侧边栏
    chrome.runtime.sendMessage({
      action: 'startAnalysis',
      data: request.data
    });
    sendResponse({ success: true });
  } else if (request.action === 'fetchKimiAPI') {
    // 处理 Kimi API 请求
    handleKimiAPIRequest(request.data).then(sendResponse);
    return true; // 保持消息通道开放
  } else if (request.action === 'checkKimiCLIServer') {
    // 检查本地 Kimi CLI 服务器状态
    checkKimiCLIServer().then(sendResponse);
    return true;
  }
});

// 处理 Kimi API 请求
async function handleKimiAPIRequest(data) {
  try {
    const { apiKey, apiType = 'moonshot', messages, model, stream = false } = data;
    
    // 如果是 kimi-code 类型，使用本地 CLI HTTP 服务器
    if (apiType === 'kimi-code') {
      return await callKimiCLIServer(messages);
    }
    
    // Moonshot Kimi API (标准格式)
    const url = 'https://api.moonshot.cn/v1/chat/completions';
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
    const body = JSON.stringify({
      model: model || 'moonshot-v1-8k',
      messages: messages,
      temperature: 0.7,
      stream: stream
    });

    console.log('Sending request to Moonshot API:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: body
    });

    console.log('API Response Status:', response.status);

    if (!response.ok) {
      let errorMessage = `API 请求失败: ${response.status}`;
      
      try {
        const error = await response.json();
        errorMessage = error.error?.message || error.message || error.error || errorMessage;
        console.error('API Error Response:', error);
      } catch (e) {
        const text = await response.text();
        console.error('API Error Text:', text);
        if (text) errorMessage = text.substring(0, 500);
      }
      
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('API Response:', result);
    return { success: true, data: result };
  } catch (error) {
    console.error('API Request Error:', error);
    return { success: false, error: error.message };
  }
}

// 调用本地 Kimi CLI HTTP 服务器
async function callKimiCLIServer(messages) {
  const CLI_SERVER_URL = 'http://127.0.0.1:8765/v1/chat/completions';
  
  try {
    console.log('Calling Kimi CLI server:', CLI_SERVER_URL);
    console.log('Messages:', messages);
    
    const response = await fetch(CLI_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: messages,
        model: 'kimi-for-coding'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Kimi CLI Server Error:', errorText);
      
      if (response.status === 0 || response.status === 502) {
        return {
          success: false,
          error: '无法连接到本地 Kimi CLI 服务器。\n\n请确保:\n1. 已运行 kimi_server.py: python native-bridge/kimi_server.py\n2. 服务器在 http://127.0.0.1:8765 启动\n\n或者使用 Moonshot API 代替。'
        };
      }
      
      throw new Error(`Kimi CLI 服务器错误: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Kimi CLI Server Response:', result);
    
    // 转换为与 OpenAI API 兼容的格式
    return {
      success: true,
      data: result
    };
    
  } catch (error) {
    console.error('Kimi CLI Server Request Error:', error);
    
    if (error.message.includes('Failed to fetch') || 
        error.message.includes('NetworkError') ||
        error.message.includes('ECONNREFUSED')) {
      return {
        success: false,
        error: '无法连接到本地 Kimi CLI 服务器。\n\n请确保:\n1. 已运行 kimi_server.py: python native-bridge/kimi_server.py\n2. 服务器在 http://127.0.0.1:8765 启动\n3. 已安装依赖: pip install flask flask-cors\n\n或者使用 Moonshot API 代替。'
      };
    }
    
    return { success: false, error: error.message };
  }
}

// 检查本地 Kimi CLI 服务器状态
async function checkKimiCLIServer() {
  const CLI_SERVER_URL = 'http://127.0.0.1:8765/health';
  
  try {
    const response = await fetch(CLI_SERVER_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      return { 
        success: true, 
        running: true,
        message: `Kimi CLI 服务器运行正常 (${data.service})`
      };
    } else {
      return { 
        success: false, 
        running: false,
        message: 'Kimi CLI 服务器响应异常'
      };
    }
  } catch (error) {
    console.error('Check Kimi CLI Server Error:', error);
    return { 
      success: false, 
      running: false,
      message: '无法连接到 Kimi CLI 服务器，请确保已运行 kimi_server.py'
    };
  }
}

// 处理图片转 base64
async function imageToBase64(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('图片转换失败:', error);
    return null;
  }
}
