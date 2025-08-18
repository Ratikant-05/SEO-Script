(function() {
  'use strict';

  // Configuration for different environments
  const CONFIG = {
    development: {
      apiBase: 'http://localhost:4444',
      enableAutoInjection: true,
      enableDebugLogs: true
    },
    production: {
      apiBase: 'https://your-seo-backend.herokuapp.com', // Replace with your deployed backend URL
      enableAutoInjection: false,
      enableDebugLogs: false
    }
  };

  // Detect environment
  function detectEnvironment() {
    const url = window.location.href;
    if (url.startsWith('file://') || url.includes('localhost') || url.includes('127.0.0.1')) {
      return 'development';
    }
    return 'production';
  }

  const ENV = detectEnvironment();
  const config = CONFIG[ENV];

  // Get site ID from script tag
  const scriptTag = document.querySelector('script[data-site-id]');
  const siteId = scriptTag ? scriptTag.getAttribute('data-site-id') : null;

  if (!siteId) {
    if (config.enableDebugLogs) {
      console.warn('SEO Sniffer: No site ID found');
    }
    return;
  }

  if (config.enableDebugLogs) {
    console.log(`SEO Sniffer: Running in ${ENV} mode`);
  }

  // Auto-detect file path (development only)
  function detectFilePath() {
    if (ENV !== 'development') return null;
    
    const url = window.location.href;
    
    if (url.startsWith('file://')) {
        let filePath = decodeURIComponent(url.replace('file:///', ''));
        if (navigator.platform.includes('Win')) {
            filePath = filePath.replace(/\//g, '\\');
        }
        return filePath;
    }
    
    return null;
  }

  // Auto-injection functionality (development only)
  async function autoInjectIntoAllFiles() {
    if (!config.enableAutoInjection) {
      if (config.enableDebugLogs) {
        console.log('SEO Sniffer: Auto-injection disabled in production');
      }
      return;
    }

    const injectionKey = `seo_sniffer_injected_${siteId}`;
    if (localStorage.getItem(injectionKey)) {
      if (config.enableDebugLogs) {
        console.log('SEO Sniffer: Auto-injection already completed for this site');
      }
      return;
    }
    
    try {
      if (config.enableDebugLogs) {
        console.log('SEO Sniffer: Starting auto-injection process...');
      }
      
      const currentScript = document.querySelector(`script[data-site-id="${siteId}"]`);
      if (!currentScript) {
        if (config.enableDebugLogs) {
          console.error('SEO Sniffer: Could not find current script tag');
        }
        return;
      }
      
      const projectPath = detectProjectPath();
      if (!projectPath) {
        if (config.enableDebugLogs) {
          console.warn('SEO Sniffer: Could not detect project path, skipping auto-injection');
        }
        return;
      }

      const response = await fetch(`${config.apiBase}/api/sites/${siteId}/auto-inject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectPath: projectPath,
          excludeFiles: ['node_modules', 'dist', 'build', '.git', 'bower_components'],
          scriptSrc: currentScript.src
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (config.enableDebugLogs) {
          console.log('SEO Sniffer: Auto-injection completed!', result.summary);
        }
        
        localStorage.setItem(injectionKey, JSON.stringify({
          timestamp: Date.now(),
          summary: result.summary
        }));
        
        showInjectionNotification(result.summary);
      } else {
        if (config.enableDebugLogs) {
          console.error('SEO Sniffer: Auto-injection failed:', await response.text());
        }
      }
    } catch (error) {
      if (config.enableDebugLogs) {
        console.error('SEO Sniffer: Auto-injection error:', error);
      }
    }
  }

  // Detect project root path (development only)
  function detectProjectPath() {
    if (ENV !== 'development') return null;
    
    const url = window.location.href;
    
    if (url.startsWith('file://')) {
      let filePath = decodeURIComponent(url.replace('file:///', ''));
      if (navigator.platform.includes('Win')) {
        filePath = filePath.replace(/\//g, '\\');
      }
      return filePath.substring(0, filePath.lastIndexOf(navigator.platform.includes('Win') ? '\\' : '/'));
    }
    
    return null;
  }

  // Show injection notification (development only)
  function showInjectionNotification(summary) {
    if (ENV !== 'development') return;
    
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      max-width: 300px;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
    `;
    
    notification.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px;">🚀 SEO Sniffer Activated!</div>
      <div style="font-size: 12px; opacity: 0.9;">
        Injected into ${summary.injected} files, skipped ${summary.skipped}
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 5000);
  }

  // Store detected file path globally
  window.seoSnifferFilePath = detectFilePath();
  
  if (config.enableDebugLogs) {
    if (window.seoSnifferFilePath) {
      console.log('SEO Sniffer: Detected file path:', window.seoSnifferFilePath);
    } else {
      console.log('SEO Sniffer: Could not detect file path');
    }
  }

  // React/SPA detection
  let isReactApp = false;
  let lastUrl = window.location.href;
  
  function detectReactApp() {
    return !!(window.React || 
              document.querySelector('[data-reactroot]') || 
              document.querySelector('#root') ||
              document.querySelector('#app') ||
              window.__REACT_DEVTOOLS_GLOBAL_HOOK__);
  }
  
  isReactApp = detectReactApp();

  // Extract SEO data from DOM
  function extractSeoData() {
    const data = {
      headings: [],
      anchors: [],
      metaDescription: '',
      metaTags: [],
      images: []
    };

    // Extract headings (h1-h6)
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(heading => {
      data.headings.push({
        tag: heading.tagName.toLowerCase(),
        text: heading.textContent.trim()
      });
    });

    // Extract anchors
    const anchors = document.querySelectorAll('a[href]');
    anchors.forEach(anchor => {
      data.anchors.push({
        href: anchor.href,
        text: anchor.textContent.trim()
      });
    });

    // Extract meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      data.metaDescription = metaDescription.getAttribute('content') || '';
    }

    // Extract all meta tags
    const metaTags = document.querySelectorAll('meta[name], meta[property]');
    metaTags.forEach(meta => {
      const name = meta.getAttribute('name');
      const property = meta.getAttribute('property');
      const content = meta.getAttribute('content');
      
      if (content) {
        data.metaTags.push({
          name: name || undefined,
          property: property || undefined,
          content: content
        });
      }
    });

    // Extract images
    const images = document.querySelectorAll('img[src]');
    images.forEach(img => {
      data.images.push({
        src: img.src,
        alt: img.getAttribute('alt') || ''
      });
    });

    return data;
  }

  // Send data to server
  function sendData(data) {
    if (wasDataSent()) {
      return;
    }

    const payload = {
      siteId: siteId,
      url: window.location.href,
      data: data,
      filePath: window.seoSnifferFilePath,
      environment: ENV
    };

    fetch(`${config.apiBase}/collect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }).then(() => {
      markDataSent();
    }).catch(error => {
      if (config.enableDebugLogs) {
        console.warn('SEO Sniffer: Failed to send data', error);
      }
    });
  }

  // Initialize based on app type
  function init() {
    if (isReactApp) {
      initReactApp();
    } else {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
          setTimeout(() => {
            const seoData = extractSeoData();
            sendData(seoData);
          }, 100);
        });
      } else {
        setTimeout(() => {
          const seoData = extractSeoData();
          sendData(seoData);
        }, 100);
      }
    }
  }

  // React-specific initialization
  function initReactApp() {
    if (config.enableDebugLogs) {
      console.log('SEO Sniffer: React app detected, using enhanced initialization');
    }
    
    function waitForReactContent() {
      let attempts = 0;
      const maxAttempts = 50;
      
      function checkContent() {
        attempts++;
        const hasContent = document.querySelector('h1, h2, h3, title') || 
                          document.body.children.length > 2;
        
        if (hasContent || attempts >= maxAttempts) {
          setTimeout(() => {
            const seoData = extractSeoData();
            sendData(seoData);
          }, 500);
        } else {
          setTimeout(checkContent, 100);
        }
      }
      
      checkContent();
    }

    function setupRouteListener() {
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;

      history.pushState = function() {
        originalPushState.apply(history, arguments);
        handleRouteChange();
      };

      history.replaceState = function() {
        originalReplaceState.apply(history, arguments);
        handleRouteChange();
      };

      window.addEventListener('popstate', handleRouteChange);
    }

    function handleRouteChange() {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        setTimeout(() => {
          const seoData = extractSeoData();
          sendData(seoData);
        }, 1000);
      }
    }

    function setupMutationObserver() {
      const observer = new MutationObserver((mutations) => {
        let significantChange = false;
        
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            for (let node of mutation.addedNodes) {
              if (node.nodeType === 1 && 
                  (node.tagName === 'H1' || node.tagName === 'H2' || 
                   node.tagName === 'TITLE' || node.querySelector('h1, h2, title'))) {
                significantChange = true;
                break;
              }
            }
          }
        });

        if (significantChange) {
          clearTimeout(window.seoSnifferTimeout);
          window.seoSnifferTimeout = setTimeout(() => {
            const seoData = extractSeoData();
            sendData(seoData);
          }, 2000);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        waitForReactContent();
        setupRouteListener();
        setupMutationObserver();
      });
    } else {
      waitForReactContent();
      setupRouteListener();
      setupMutationObserver();
    }
  }

  // Initialize the sniffer
  init();
  
  // Run auto-injection after delay (development only)
  if (config.enableAutoInjection) {
    setTimeout(() => {
      autoInjectIntoAllFiles();
    }, 2000);
  }

  // Session management
  let dataSent = false;
  
  function markDataSent() {
    dataSent = true;
    sessionStorage.setItem(`seo-sniffer-sent-${siteId}`, window.location.href);
  }
  
  function wasDataSent() {
    return sessionStorage.getItem(`seo-sniffer-sent-${siteId}`) === window.location.href;
  }

})();
