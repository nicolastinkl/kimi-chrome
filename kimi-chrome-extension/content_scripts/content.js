// 内容脚本 - 提取页面内容
(function() {
  'use strict';

  // 避免重复注入
  if (window.kimiContentScriptInjected) {
    return;
  }
  window.kimiContentScriptInjected = true;

  // 监听来自 popup 或 background 的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractPageContent') {
      extractPageContent().then(sendResponse);
      return true; // 保持消息通道开放
    } else if (request.action === 'highlightElement') {
      highlightElement(request.selector);
      sendResponse({ success: true });
    }
  });

  // 提取页面内容
  async function extractPageContent() {
    try {
      // 获取页面基本信息
      const pageInfo = {
        url: window.location.href,
        title: document.title,
        description: getMetaContent('description') || getMetaContent('og:description'),
        keywords: getMetaContent('keywords'),
        author: getMetaContent('author'),
        publishDate: getMetaContent('article:published_time') || getMetaContent('publishdate'),
        siteName: getMetaContent('og:site_name'),
        favicon: getFavicon(),
        timestamp: new Date().toISOString()
      };

      // 获取主要内容
      const mainContent = extractMainContent();
      
      // 获取页面图片
      const images = await extractImages();

      // 获取页面结构
      const structure = analyzePageStructure();

      return {
        success: true,
        data: {
          pageInfo,
          mainContent,
          images,
          structure
        }
      };
    } catch (error) {
      console.error('提取页面内容失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 获取 meta 标签内容
  function getMetaContent(name) {
    const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
    return meta ? meta.getAttribute('content') : '';
  }

  // 获取网站图标
  function getFavicon() {
    const favicon = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
    return favicon ? favicon.href : '';
  }

  // 提取主要内容（使用多种策略）
  function extractMainContent() {
    // 尝试找到主要内容区域
    const contentSelectors = [
      'article',
      '[role="main"]',
      'main',
      '.content',
      '.post-content',
      '.article-content',
      '.entry-content',
      '#content',
      '#main-content',
      '.post',
      '.article'
    ];

    let mainElement = null;
    let maxTextLength = 0;

    // 尝试选择器
    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const textLength = element.innerText.length;
        if (textLength > maxTextLength) {
          maxTextLength = textLength;
          mainElement = element;
        }
      }
    }

    // 如果没有找到，使用 readability 算法
    if (!mainElement || maxTextLength < 200) {
      mainElement = findMainContentByAlgorithm();
    }

    // 提取文本内容
    const content = mainElement ? cleanText(mainElement.innerText) : cleanText(document.body.innerText);
    
    // 提取 HTML 结构（用于保留格式）
    const htmlContent = mainElement ? cleanHtml(mainElement.innerHTML) : '';

    // 提取标题
    const headings = extractHeadings(mainElement || document.body);

    // 提取链接
    const links = extractLinks(mainElement || document.body);

    return {
      text: content.substring(0, 15000), // 限制长度
      html: htmlContent,
      headings,
      links: links.slice(0, 20), // 限制链接数量
      wordCount: content.split(/\s+/).length,
      charCount: content.length
    };
  }

  // 使用算法查找主要内容
  function findMainContentByAlgorithm() {
    const candidates = [];
    const paragraphs = document.querySelectorAll('p, div, section');
    
    paragraphs.forEach(el => {
      const text = el.innerText.trim();
      const linkDensity = calculateLinkDensity(el);
      const textDensity = text.length / (el.innerHTML.length || 1);
      
      // 评分算法
      const score = text.length * (1 - linkDensity) * textDensity;
      
      if (text.length > 100 && linkDensity < 0.3) {
        candidates.push({ element: el, score });
      }
    });

    candidates.sort((a, b) => b.score - a.score);
    return candidates.length > 0 ? candidates[0].element : null;
  }

  // 计算链接密度
  function calculateLinkDensity(element) {
    const textLength = element.innerText.length;
    if (textLength === 0) return 0;
    
    const links = element.querySelectorAll('a');
    let linkTextLength = 0;
    links.forEach(link => {
      linkTextLength += link.innerText.length;
    });
    
    return linkTextLength / textLength;
  }

  // 清理文本
  function cleanText(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }

  // 清理 HTML
  function cleanHtml(html) {
    // 移除 script 和 style 标签
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .substring(0, 50000);
  }

  // 提取标题
  function extractHeadings(container) {
    const headings = [];
    const elements = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    elements.forEach(el => {
      const text = el.innerText.trim();
      if (text) {
        headings.push({
          level: parseInt(el.tagName[1]),
          text: text
        });
      }
    });
    
    return headings;
  }

  // 提取链接
  function extractLinks(container) {
    const links = [];
    const elements = container.querySelectorAll('a[href]');
    const seen = new Set();
    
    elements.forEach(el => {
      const href = el.href;
      const text = el.innerText.trim();
      
      // 去重并过滤
      if (!seen.has(href) && text && !href.startsWith('javascript:')) {
        seen.add(href);
        links.push({
          url: href,
          text: text.substring(0, 100)
        });
      }
    });
    
    return links;
  }

  // 提取图片
  async function extractImages() {
    const images = [];
    const imgElements = document.querySelectorAll('img');
    const seen = new Set();

    for (const img of imgElements) {
      try {
        // 获取图片 URL
        let src = img.src || img.dataset.src || img.dataset.original;
        
        // 处理相对路径
        if (src && !src.startsWith('http') && !src.startsWith('data:')) {
          src = new URL(src, window.location.href).href;
        }

        if (!src || seen.has(src)) continue;
        
        // 过滤小图片和图标
        const width = img.naturalWidth || img.width || 100;
        const height = img.naturalHeight || img.height || 100;
        
        if (width < 100 || height < 100) continue;
        
        seen.add(src);
        
        // 获取图片周围的文本上下文
        const context = getImageContext(img);
        
        images.push({
          src: src,
          alt: img.alt || '',
          title: img.title || '',
          width: width,
          height: height,
          context: context,
          isMainImage: isMainImage(img, width, height)
        });
      } catch (error) {
        console.warn('处理图片失败:', error);
      }
    }

    // 按重要性排序
    images.sort((a, b) => {
      if (a.isMainImage && !b.isMainImage) return -1;
      if (!a.isMainImage && b.isMainImage) return 1;
      return (b.width * b.height) - (a.width * a.height);
    });

    // 限制数量
    return images.slice(0, 10);
  }

  // 获取图片上下文
  function getImageContext(img) {
    // 尝试找到图片的标题或说明
    const figure = img.closest('figure');
    if (figure) {
      const caption = figure.querySelector('figcaption');
      if (caption) return caption.innerText.trim();
    }

    // 检查相邻元素
    const parent = img.parentElement;
    if (parent) {
      // 检查父元素的文本
      const parentText = parent.innerText.replace(img.alt || '', '').trim();
      if (parentText && parentText.length < 200) {
        return parentText;
      }
    }

    // 检查图片后的段落
    let nextEl = img.parentElement?.nextElementSibling;
    if (nextEl && nextEl.tagName === 'P') {
      return nextEl.innerText.trim().substring(0, 200);
    }

    return '';
  }

  // 判断是否是主图
  function isMainImage(img, width, height) {
    // 检查是否是文章的主要图片
    const aspectRatio = width / height;
    
    // 检查是否在文章顶部
    const rect = img.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    // 在视口上方且较大的图片可能是主图
    if (rect.top < viewportHeight * 0.5 && width > 400 && aspectRatio > 1.2 && aspectRatio < 2.5) {
      return true;
    }

    // 检查是否有特殊标记
    if (img.classList.contains('featured') || 
        img.classList.contains('hero') ||
        img.id === 'main-image') {
      return true;
    }

    return false;
  }

  // 分析页面结构
  function analyzePageStructure() {
    return {
      hasArticle: !!document.querySelector('article'),
      hasMain: !!document.querySelector('main'),
      headingCount: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
      paragraphCount: document.querySelectorAll('p').length,
      imageCount: document.querySelectorAll('img').length,
      linkCount: document.querySelectorAll('a').length,
      videoCount: document.querySelectorAll('video').length,
      tableCount: document.querySelectorAll('table').length,
      listCount: document.querySelectorAll('ul, ol').length
    };
  }

  // 高亮元素
  function highlightElement(selector) {
    // 移除之前的高亮
    document.querySelectorAll('.kimi-highlight').forEach(el => {
      el.classList.remove('kimi-highlight');
    });

    // 添加新高亮
    const element = document.querySelector(selector);
    if (element) {
      element.classList.add('kimi-highlight');
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // 3秒后移除高亮
      setTimeout(() => {
        element.classList.remove('kimi-highlight');
      }, 3000);
    }
  }

  // 添加浮动分析按钮到页面
  function addFloatingButton() {
    // 检查是否已存在
    if (document.getElementById('kimi-floating-btn')) {
      return;
    }

    const button = document.createElement('div');
    button.id = 'kimi-floating-btn';
    button.innerHTML = `
      <div class="kimi-floating-icon">🤖</div>
      <div class="kimi-floating-text">Kimi 分析</div>
    `;
    button.addEventListener('click', async () => {
      const content = await extractPageContent();
      chrome.runtime.sendMessage({
        action: 'openSidePanel'
      });
      setTimeout(() => {
        chrome.runtime.sendMessage({
          action: 'startAnalysis',
          data: content.data
        });
      }, 500);
    });

    document.body.appendChild(button);
  }

  // 页面加载完成后添加浮动按钮
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addFloatingButton);
  } else {
    addFloatingButton();
  }
})();
