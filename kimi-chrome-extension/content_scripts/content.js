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
    try {
      if (request.action === 'extractPageContent') {
        extractPageContent(request.autoLoadComments).then(result => {
          try {
            sendResponse(result);
          } catch (e) {
            console.log('Extension context invalidated during response');
          }
        }).catch(error => {
          console.error('提取页面内容失败:', error);
          try {
            sendResponse({ success: false, error: error.message });
          } catch (e) {
            console.log('Extension context invalidated during error response');
          }
        });
        return true; // 保持消息通道开放
      } else if (request.action === 'highlightElement') {
        highlightElement(request.selector);
        try {
          sendResponse({ success: true });
        } catch (e) {
          console.log('Extension context invalidated');
        }
      }
    } catch (error) {
      console.error('Message handler error:', error);
      if (error.message && error.message.includes('Extension context invalidated')) {
        console.log('Extension was reloaded, content script needs refresh');
      }
    }
  });

  // 提取页面内容
  async function extractPageContent(autoLoadComments = true) {
    try {
      // 检测是否是小红书网站
      const isXiaohongshu = isXiaohongshuDomain();
      
      if (isXiaohongshu) {
        // 如果是小红书，使用专门的小红书数据提取
        const xiaohongshuData = await extractXiaohongshuData(autoLoadComments);
        return {
          success: true,
          data: {
            pageInfo: {
              url: window.location.href,
              title: document.title,
              siteName: '小红书',
              timestamp: new Date().toISOString()
            },
            platform: 'xiaohongshu',
            xiaohongshuData,
            structure: analyzePageStructure()
          }
        };
      }

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

  // 检测是否是小红书域名
  function isXiaohongshuDomain() {
    const hostname = window.location.hostname;
    return hostname.includes('xiaohongshu.com') || 
           hostname.includes('xhslink.com') ||
           hostname.includes('xiaohongshu');
  }

  // 提取小红书数据
  function extractXiaohongshuData() {
    const data = {
      title: '',
      content: '',
      author: {
        nickname: '',
        userId: '',
        avatar: '',
        link: ''
      },
      stats: {
        likes: 0,
        favorites: 0,
        comments: 0
      },
      media: {
        images: [],
        videos: []
      },
      comments: []
    };

    try {
      // 1. 提取标题
      const titleSelectors = [
        'h1.title',
        'h1',
        '.note-title',
        '.title',
        '[data-testid="note-title"]',
        '.note-content h1',
        '.main-content h1'
      ];
      
      for (const selector of titleSelectors) {
        const titleEl = document.querySelector(selector);
        if (titleEl && titleEl.innerText.trim()) {
          data.title = titleEl.innerText.trim();
          break;
        }
      }

      // 2. 提取正文内容
      const contentSelectors = [
        '.note-content .content',
        '.note-content',
        '.content',
        '.desc',
        '.note-desc',
        '[data-testid="note-content"]',
        '.main-content .desc',
        '.detail-content'
      ];
      
      for (const selector of contentSelectors) {
        const contentEl = document.querySelector(selector);
        if (contentEl && contentEl.innerText.trim()) {
          data.content = contentEl.innerText.trim();
          break;
        }
      }

      // 3. 提取作者信息
      const authorSelectors = [
        '.author-info',
        '.user-info',
        '.author',
        '.publisher',
        '[data-testid="author-info"]',
        '.note-author'
      ];
      
      for (const selector of authorSelectors) {
        const authorEl = document.querySelector(selector);
        if (authorEl) {
          // 提取昵称
          const nicknameSelectors = ['.nickname', '.name', '.username', 'a span', '.user-name', 'span'];
          for (const nameSelector of nicknameSelectors) {
            const nameEl = authorEl.querySelector(nameSelector);
            if (nameEl && nameEl.innerText.trim()) {
              data.author.nickname = nameEl.innerText.trim();
              break;
            }
          }
          
          // 提取用户ID/链接
          const userLink = authorEl.querySelector('a');
          if (userLink) {
            data.author.link = userLink.href;
            const userIdMatch = userLink.href.match(/user\/([^\/\?]+)/);
            if (userIdMatch) {
              data.author.userId = userIdMatch[1];
            }
          }
          
          // 提取头像
          const avatarEl = authorEl.querySelector('img');
          if (avatarEl) {
            data.author.avatar = avatarEl.src || avatarEl.dataset.src || '';
          }
          
          break;
        }
      }

      // 4. 提取统计数据（点赞、收藏、评论数）
      const statsSelectors = [
        '.interaction-container',
        '.stats',
        '.note-stats',
        '.interaction',
        '.actions',
        '[data-testid="note-stats"]'
      ];
      
      for (const selector of statsSelectors) {
        const statsEl = document.querySelector(selector);
        if (statsEl) {
          // 点赞数
          const likeSelectors = ['.like', '.likes', '.liked', '[data-type="like"]', '.icon-like + span', '.icon-like + div'];
          for (const likeSelector of likeSelectors) {
            const likeEl = statsEl.querySelector(likeSelector);
            if (likeEl) {
              const likeText = likeEl.innerText.trim();
              data.stats.likes = parseNumber(likeText);
              break;
            }
          }
          
          // 收藏数
          const favSelectors = ['.favorite', '.favorites', '.collect', '.collected', '[data-type="favorite"]', '.icon-star + span', '.icon-star + div'];
          for (const favSelector of favSelectors) {
            const favEl = statsEl.querySelector(favSelector);
            if (favEl) {
              const favText = favEl.innerText.trim();
              data.stats.favorites = parseNumber(favText);
              break;
            }
          }
          
          // 评论数
          const commentSelectors = ['.comment', '.comments', '[data-type="comment"]', '.icon-comment + span', '.icon-comment + div'];
          for (const commentSelector of commentSelectors) {
            const commentEl = statsEl.querySelector(commentSelector);
            if (commentEl) {
              const commentText = commentEl.innerText.trim();
              data.stats.comments = parseNumber(commentText);
              break;
            }
          }
          
          break;
        }
      }

      // 5. 提取图片/视频链接
      // 图片
      const imageSelectors = [
        '.note-content img',
        '.swiper-slide img',
        '.image-container img',
        '.media-container img',
        '.note-images img',
        'img[src*="xhs"]'
      ];
      
      const seenImages = new Set();
      for (const selector of imageSelectors) {
        const images = document.querySelectorAll(selector);
        images.forEach(img => {
          let src = img.src || img.dataset.src || img.dataset.original || '';
          if (src && !seenImages.has(src) && src.startsWith('http')) {
            seenImages.add(src);
            data.media.images.push({
              url: src,
              alt: img.alt || '',
              width: img.naturalWidth || img.width || 0,
              height: img.naturalHeight || img.height || 0
            });
          }
        });
      }

      // 视频
      const videoSelectors = [
        'video',
        '.video-player video',
        '.video-container video',
        'video[src]'
      ];
      
      for (const selector of videoSelectors) {
        const videos = document.querySelectorAll(selector);
        videos.forEach(video => {
          const src = video.src || video.querySelector('source')?.src || '';
          if (src) {
            data.media.videos.push({
              url: src,
              poster: video.poster || ''
            });
          }
        });
      }

      // 6. 提取评论数据
      if (autoLoadComments) {
        // 自动加载所有评论
        const loadResult = await loadAllXiaohongshuComments();
        data.comments = loadResult.comments;
        data.commentsLoaded = loadResult.loaded;
        data.totalCommentsLoaded = loadResult.totalLoaded;
      } else {
        // 只提取当前可见的评论
        data.comments = extractXiaohongshuComments();
        data.commentsLoaded = true;
        data.totalCommentsLoaded = data.comments.length;
      }

    } catch (error) {
      console.error('提取小红书数据失败:', error);
    }

    return data;
  }

  // 提取小红书评论数据
  function extractXiaohongshuComments() {
    const comments = [];
    
    try {
      // 评论列表容器选择器
      const commentListSelectors = [
        '.comments',
        '.comment-list',
        '.comments-container',
        '.note-comments',
        '[data-testid="comment-list"]',
        '.comment-section'
      ];
      
      let commentListEl = null;
      for (const selector of commentListSelectors) {
        commentListEl = document.querySelector(selector);
        if (commentListEl) break;
      }

      if (!commentListEl) {
        // 尝试在整个文档中查找评论项
        commentListEl = document.body;
      }

      // 评论项选择器
      const commentItemSelectors = [
        '.comment-item',
        '.comment',
        '.comment-card',
        '[data-testid="comment-item"]',
        '.comment-wrapper'
      ];
      
      let commentItems = [];
      for (const selector of commentItemSelectors) {
        commentItems = commentListEl.querySelectorAll(selector);
        if (commentItems.length > 0) break;
      }

      commentItems.forEach((item, index) => {
        try {
          const comment = {
            id: index + 1,
            content: '',
            author: {
              nickname: '',
              userId: '',
              avatar: ''
            },
            likes: 0,
            time: '',
            replies: []
          };

          // 提取评论内容
          const contentSelectors = ['.comment-content', '.text', '.content', '.comment-text', 'p'];
          for (const selector of contentSelectors) {
            const contentEl = item.querySelector(selector);
            if (contentEl && contentEl.innerText.trim()) {
              comment.content = contentEl.innerText.trim();
              break;
            }
          }

          // 提取评论者信息
          const userSelectors = ['.user-info', '.user', '.author', '.comment-author'];
          for (const selector of userSelectors) {
            const userEl = item.querySelector(selector);
            if (userEl) {
              const nameSelectors = ['.nickname', '.name', '.username', 'span'];
              for (const nameSelector of nameSelectors) {
                const nameEl = userEl.querySelector(nameSelector);
                if (nameEl && nameEl.innerText.trim()) {
                  comment.author.nickname = nameEl.innerText.trim();
                  break;
                }
              }
              
              const avatarEl = userEl.querySelector('img');
              if (avatarEl) {
                comment.author.avatar = avatarEl.src || '';
              }
              
              break;
            }
          }

          // 提取点赞数
          const likeSelectors = ['.like', '.likes', '.like-count', '.thumb'];
          for (const selector of likeSelectors) {
            const likeEl = item.querySelector(selector);
            if (likeEl) {
              const likeText = likeEl.innerText.trim();
              comment.likes = parseNumber(likeText);
              break;
            }
          }

          // 提取时间
          const timeSelectors = ['.time', '.date', '.timestamp'];
          for (const selector of timeSelectors) {
            const timeEl = item.querySelector(selector);
            if (timeEl && timeEl.innerText.trim()) {
              comment.time = timeEl.innerText.trim();
              break;
            }
          }

          // 提取回复
          const replySelectors = ['.reply', '.replies', '.reply-list', '.sub-comment'];
          for (const selector of replySelectors) {
            const replyContainer = item.querySelector(selector);
            if (replyContainer) {
              const replyItems = replyContainer.querySelectorAll('.reply-item, .sub-comment-item, .reply');
              replyItems.forEach((replyItem, replyIndex) => {
                const reply = {
                  id: `${index + 1}-${replyIndex + 1}`,
                  content: '',
                  author: {
                    nickname: ''
                  }
                };

                const replyContentEl = replyItem.querySelector('.content, .text, .reply-content, p');
                if (replyContentEl) {
                  reply.content = replyContentEl.innerText.trim();
                }

                const replyAuthorEl = replyItem.querySelector('.nickname, .name, .username');
                if (replyAuthorEl) {
                  reply.author.nickname = replyAuthorEl.innerText.trim();
                }

                if (reply.content) {
                  comment.replies.push(reply);
                }
              });
              
              break;
            }
          }

          if (comment.content) {
            comments.push(comment);
          }
        } catch (err) {
          console.warn('处理评论项失败:', err);
        }
      });

    } catch (error) {
      console.error('提取评论失败:', error);
    }

    return comments;
  }

  // 自动加载所有小红书评论
  async function loadAllXiaohongshuComments() {
    const allComments = [];
    let previousCommentCount = 0;
    let noChangeCount = 0;
    const maxNoChange = 3; // 连续3次没有新评论则停止
    const maxScrollAttempts = 50; // 最大滚动次数
    
    console.log('开始自动加载小红书评论...');
    
    // 查找评论容器
    const commentContainerSelectors = [
      '.comments',
      '.comment-list',
      '.comments-container',
      '.note-comments',
      '[data-testid="comment-list"]',
      '.comment-section',
      '.main-container .comments-area'
    ];
    
    let commentContainer = null;
    for (const selector of commentContainerSelectors) {
      commentContainer = document.querySelector(selector);
      if (commentContainer) {
        console.log('找到评论容器:', selector);
        break;
      }
    }
    
    // 如果没有找到容器，尝试查找评论项的父容器
    if (!commentContainer) {
      const commentItems = document.querySelectorAll('.comment-item, .comment, [data-testid="comment-item"]');
      if (commentItems.length > 0) {
        commentContainer = commentItems[0].parentElement;
        console.log('使用评论项父元素作为容器');
      }
    }
    
    if (!commentContainer) {
      console.log('未找到评论容器，提取当前可见评论');
      return extractXiaohongshuComments();
    }
    
    // 滚动加载循环
    for (let attempt = 0; attempt < maxScrollAttempts; attempt++) {
      // 提取当前可见的评论
      const currentComments = extractXiaohongshuComments();
      
      // 合并新评论（去重）
      currentComments.forEach(comment => {
        const isDuplicate = allComments.some(existing => 
          existing.content === comment.content && 
          existing.author?.nickname === comment.author?.nickname
        );
        if (!isDuplicate && comment.content) {
          allComments.push(comment);
        }
      });
      
      console.log(`第 ${attempt + 1} 次滚动，当前共 ${allComments.length} 条评论`);
      
      // 检查是否有新评论
      if (allComments.length === previousCommentCount) {
        noChangeCount++;
        if (noChangeCount >= maxNoChange) {
          console.log('连续多次没有新评论，停止加载');
          break;
        }
      } else {
        noChangeCount = 0;
        previousCommentCount = allComments.length;
      }
      
      // 滚动到容器底部
      const scrollHeight = commentContainer.scrollHeight;
      commentContainer.scrollTo({
        top: scrollHeight,
        behavior: 'smooth'
      });
      
      // 同时滚动页面主容器（有些网站使用页面滚动）
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: 'smooth'
      });
      
      // 等待新内容加载
      await sleep(1500);
      
      // 尝试点击"加载更多"按钮
      const loadMoreBtn = findLoadMoreButton();
      if (loadMoreBtn) {
        console.log('点击加载更多按钮');
        loadMoreBtn.click();
        await sleep(1000);
      }
    }
    
    console.log(`评论加载完成，共 ${allComments.length} 条评论`);
    return {
      comments: allComments,
      loaded: true,
      totalLoaded: allComments.length
    };
  }
  
  // 查找"加载更多"按钮
  function findLoadMoreButton() {
    const btnSelectors = [
      '.load-more',
      '.load-more-btn',
      '.show-more',
      '.show-more-comments',
      '.fetch-more',
      '.fetch-more-comments',
      '[data-testid="load-more"]',
      'button:contains("加载更多")',
      'button:contains("查看更多")',
      'button:contains("展开")',
      '.comment-load-more',
      '.comments-load-more'
    ];
    
    for (const selector of btnSelectors) {
      // 处理 :contains 伪类
      if (selector.includes(':contains')) {
        const baseSelector = selector.split(':contains')[0];
        const text = selector.match(/"([^"]+)"/)?.[1];
        const elements = document.querySelectorAll(baseSelector);
        for (const el of elements) {
          if (el.textContent.includes(text) && isElementVisible(el)) {
            return el;
          }
        }
      } else {
        const btn = document.querySelector(selector);
        if (btn && isElementVisible(btn)) {
          return btn;
        }
      }
    }
    return null;
  }
  
  // 检查元素是否可见
  function isElementVisible(el) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && 
           rect.height > 0 && 
           style.visibility !== 'hidden' && 
           style.display !== 'none' &&
           style.opacity !== '0';
  }
  
  // 延迟函数
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 解析数字（处理 "1.2万" 等格式）
  function parseNumber(text) {
    if (!text) return 0;
    
    text = text.toString().trim();
    
    // 处理 "万"
    if (text.includes('万')) {
      const num = parseFloat(text.replace('万', ''));
      return Math.round(num * 10000);
    }
    
    // 处理 "k" 或 "K"
    if (text.toLowerCase().includes('k')) {
      const num = parseFloat(text.replace(/[kK]/, ''));
      return Math.round(num * 1000);
    }
    
    // 处理普通数字
    const num = parseInt(text.replace(/[^\d]/g, ''));
    return isNaN(num) ? 0 : num;
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
      try {
        const content = await extractPageContent();
        chrome.runtime.sendMessage({
          action: 'openSidePanel'
        }, () => {
          if (chrome.runtime.lastError) {
            console.log('Extension context invalidated, please refresh the page');
            alert('扩展已更新，请刷新页面后重试');
            return;
          }
          setTimeout(() => {
            try {
              chrome.runtime.sendMessage({
                action: 'startAnalysis',
                data: content.data
              });
            } catch (e) {
              console.log('Failed to send analysis data');
            }
          }, 500);
        });
      } catch (error) {
        console.error('Failed to extract content:', error);
        alert('提取内容失败，请刷新页面后重试');
      }
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
