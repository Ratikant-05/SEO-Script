(function() {
  'use strict';

  // Get site ID and file path from script tag
  const scriptTag = document.querySelector('script[data-site-id]');
  const siteId = scriptTag ? scriptTag.getAttribute('data-site-id') : null;

  if (!siteId) {
    console.warn('SEO Sniffer: No site ID found');
    return;
  }

  // Auto-detect file path for local development
  function detectFilePath() {
    const url = window.location.href;
    
    // For file:// protocol
    if (url.startsWith('file://')) {
        let filePath = decodeURIComponent(url.replace('file:///', ''));
        // Convert forward slashes to backslashes for Windows
        if (navigator.platform.includes('Win')) {
            filePath = filePath.replace(/\//g, '\\');
        }
        return filePath;
    }
    
    // For localhost with Live Server (common pattern)
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
        // Cannot reliably detect file system path from localhost URL
        console.warn('SEO Sniffer: Cannot detect file system path for localhost URLs');
        return null;
    }
    
    return null;
  }

  // Auto-injection functionality
  async function autoInjectIntoAllFiles() {
    // Skip auto-injection on production sites - only for local development
    const url = window.location.href;
    if (!url.startsWith('file://') && !url.includes('localhost') && !url.includes('127.0.0.1')) {
        console.log('SEO Sniffer: Production environment detected, skipping auto-injection');
        return;
    }
    
    // Check if this script has already performed auto-injection
    const injectionKey = `seo_sniffer_injected_${siteId}`;
    if (localStorage.getItem(injectionKey)) {
        console.log('SEO Sniffer: Auto-injection already completed for this site');
        return;
    }
    
    try {
        console.log('SEO Sniffer: Starting auto-injection process...');
        
        // Get the current script tag to replicate
        const currentScript = document.querySelector(`script[data-site-id="${siteId}"]`);
        if (!currentScript) {
            console.error('SEO Sniffer: Could not find current script tag');
            return;
        }
        
        const scriptSrc = currentScript.src;
        
        const projectPath = detectProjectPath();
        if (!projectPath) {
            console.warn('SEO Sniffer: Could not detect project path, skipping auto-injection');
            return;
        }

        console.log('SEO Sniffer: Detected project path:', projectPath);

        // Determine API endpoint based on environment
        const isProduction = !window.location.href.includes('localhost') && 
                            !window.location.href.includes('127.0.0.1') && 
                            !window.location.href.startsWith('file://');
        
        const apiEndpoint = isProduction ? 
          'https://seo-script-hqz1.onrender.com/api/sites' : 
          'http://localhost:4444/api/sites';

        // Request auto-injection from backend
        const response = await fetch(`${apiEndpoint}/${siteId}/auto-inject`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                projectPath: projectPath,
                excludeFiles: ['node_modules', 'dist', 'build', '.git', 'bower_components'],
                scriptSrc: scriptSrc
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('SEO Sniffer: Auto-injection completed!', result.summary);
            
            // Mark injection as completed
            localStorage.setItem(injectionKey, JSON.stringify({
                timestamp: Date.now(),
                summary: result.summary
            }));
            
            // Optional: Show a subtle notification
            showInjectionNotification(result.summary);
        } else {
            console.error('SEO Sniffer: Auto-injection failed:', await response.text());
        }
    } catch (error) {
        console.error('SEO Sniffer: Auto-injection error:', error);
    }
  }

  // Detect project root path
  function detectProjectPath() {
    const url = window.location.href;
    
    if (url.startsWith('file://')) {
        // Extract directory from file path
        let filePath = decodeURIComponent(url.replace('file:///', ''));
        // Convert forward slashes to backslashes for Windows
        if (navigator.platform.includes('Win')) {
            filePath = filePath.replace(/\//g, '\\');
        }
        return filePath.substring(0, filePath.lastIndexOf(navigator.platform.includes('Win') ? '\\' : '/'));
    }
    
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
        // For localhost, we can't reliably detect the file system path
        // Return null to indicate path detection failed
        console.warn('SEO Sniffer: Cannot detect file system path for localhost. Auto-injection skipped.');
        return null;
    }
    
    return null;
  }

  // Get username (best guess)
  function getUsername() {
    // Try to extract from various sources
    if (navigator.userAgentData && navigator.userAgentData.platform) {
        return 'User'; // Generic fallback
    }
    return 'User';
  }

  // Show subtle notification about injection
  function showInjectionNotification(summary) {
    // Create a small, non-intrusive notification
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
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto-remove after 5 seconds
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

  // Auto-crawl all HTML files in project
  async function autoCrawlProject() {
    // Skip auto-crawl on production sites - only for local development
    const url = window.location.href;
    if (!url.startsWith('file://') && !url.includes('localhost') && !url.includes('127.0.0.1')) {
        console.log('SEO Sniffer: Production environment detected, skipping auto-crawl');
        return;
    }
    
    // Check if crawling was already done recently
    const crawlKey = `seo_sniffer_crawled_${siteId}`;
    const lastCrawl = localStorage.getItem(crawlKey);
    if (lastCrawl) {
        const lastCrawlTime = JSON.parse(lastCrawl).timestamp;
        const timeSinceLastCrawl = Date.now() - lastCrawlTime;
        // Skip if crawled within last 10 minutes
        if (timeSinceLastCrawl < 10 * 60 * 1000) {
            console.log('SEO Sniffer: Auto-crawl skipped - recent crawl exists');
            return;
        }
    }
    
    try {
        console.log('SEO Sniffer: Starting automatic project crawl...');
        
        const projectPath = detectProjectPath();
        if (!projectPath) {
            console.warn('SEO Sniffer: Could not detect project path, skipping auto-crawl');
            return;
        }

        console.log('SEO Sniffer: Detected project path for crawl:', projectPath);

        // Determine API endpoint based on environment
        const isProduction = !window.location.href.includes('localhost') && 
                            !window.location.href.includes('127.0.0.1') && 
                            !window.location.href.startsWith('file://');
        
        const apiEndpoint = isProduction ? 
          'https://seo-script-hqz1.onrender.com/api/sites' : 
          'http://localhost:4444/api/sites';

        // Request crawling from backend
        const response = await fetch(`${apiEndpoint}/${siteId}/crawl`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                projectPath: projectPath,
                excludeFiles: ['node_modules', 'dist', 'build', '.git', 'bower_components']
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('SEO Sniffer: Auto-crawl completed!', result.summary);
            
            // Mark crawl as completed
            localStorage.setItem(crawlKey, JSON.stringify({
                timestamp: Date.now(),
                summary: result.summary
            }));
            
            // Show crawl notification
            showCrawlNotification(result.summary);
        } else {
            console.error('SEO Sniffer: Auto-crawl failed:', await response.text());
        }
    } catch (error) {
        console.error('SEO Sniffer: Auto-crawl error:', error);
    }
  }

  // Show crawl completion notification
  function showCrawlNotification(summary) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
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
        <div style="font-weight: bold; margin-bottom: 4px;">🔍 Project Crawled!</div>
        <div style="font-size: 12px; opacity: 0.9;">
            Processed ${summary.processed} pages, skipped ${summary.skipped}
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto-remove after 6 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 6000);
  }

  // Store detected file path globally
  window.seoSnifferFilePath = detectFilePath();
  
  // Debug log the detected file path
  if (window.seoSnifferFilePath) {
    console.log('SEO Sniffer: Detected file path:', window.seoSnifferFilePath);
  } else {
    console.log('SEO Sniffer: Could not detect file path');
  }

  // React/SPA detection and handling
  let isReactApp = false;
  let lastUrl = window.location.href;
  
  // Detect if this is a React app
  function detectReactApp() {
    // Check multiple indicators for React
    const hasReact = !!(window.React || window.ReactDOM);
    const hasReactRoot = !!(document.querySelector('[data-reactroot]') || 
                           document.querySelector('#root') ||
                           document.querySelector('#app'));
    const hasReactDevTools = !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    const hasReactFiber = !!document.querySelector('[data-reactroot], [data-react-checksum]');
    
    return hasReact || hasReactRoot || hasReactDevTools || hasReactFiber;
  }
  
  // Wait for React libraries to load before detecting
  function waitForReactDetection() {
    let attempts = 0;
    const maxAttempts = 30;
    
    function checkReact() {
      attempts++;
      isReactApp = detectReactApp();
      
      if (isReactApp || attempts >= maxAttempts) {
        console.log('SEO Sniffer: React detection complete. Is React app:', isReactApp);
        return;
      } else {
        setTimeout(checkReact, 100);
      }
    }
    
    checkReact();
  }
  
  // Initial detection
  isReactApp = detectReactApp();
  
  // If not detected initially, wait for React to load
  if (!isReactApp) {
    waitForReactDetection();
  }

  // Extract SEO data from DOM
  function extractSeoData() {
    const data = {
      headings: [],
      anchors: [],
      metaDescription: '',
      metaTags: [],
      images: [],
      paragraphs: [],
      divs: []
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

    // Extract paragraphs
    const paragraphs = document.querySelectorAll('p');
    paragraphs.forEach(p => {
      const text = p.textContent.trim();
      if (text) {
        data.paragraphs.push({
          text: text,
          length: text.length
        });
      }
    });

    // Extract divs with text content
    const divs = document.querySelectorAll('div');
    divs.forEach(div => {
      const text = div.textContent.trim();
      // Only include divs with direct text content (not just nested elements)
      const directText = Array.from(div.childNodes)
        .filter(node => node.nodeType === 3) // Text nodes only
        .map(node => node.textContent.trim())
        .join(' ')
        .trim();
      
      if (directText && directText.length > 10) { // Only meaningful text content
        data.divs.push({
          text: directText,
          length: directText.length,
          className: div.className || '',
          id: div.id || ''
        });
      }
    });

    return data;
  }

  // Send data to server
  function sendData(data) {
    // Check if data was already sent for this page
    if (wasDataSent()) {
      return;
    }

    const payload = {
      siteId: siteId,
      url: window.location.href,
      data: data,
      filePath: window.seoSnifferFilePath // Include detected file path
    };

    // Determine API endpoint based on environment
    const isProduction = !window.location.href.includes('localhost') && 
                        !window.location.href.includes('127.0.0.1') && 
                        !window.location.href.startsWith('file://');
    
    const apiEndpoint = isProduction ? 
      'https://seo-script-hqz1.onrender.com/collect' : 
      'http://localhost:4444/collect';

    // Use fetch without keepalive to avoid tab switch issues
    fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }).then(() => {
      markDataSent();
    }).catch(error => {
      console.warn('SEO Sniffer: Failed to send data', error);
    });
  }

  // Wait for DOM to be ready - React-compatible version
  function init() {
    if (isReactApp) {
      // For React apps, wait longer and use multiple strategies
      initReactApp();
    } else {
      // Standard initialization for regular websites
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
    console.log('SEO Sniffer: React app detected, using enhanced initialization');
    
    // Strategy 1: Wait for React to fully render with better detection
    function waitForReactContent() {
      let attempts = 0;
      const maxAttempts = 100; // 10 seconds max for React apps
      
      function checkContent() {
        attempts++;
        
        // More comprehensive content detection for React
        const rootElement = document.getElementById('root') || document.getElementById('app');
        const hasReactContent = rootElement && rootElement.children.length > 0;
        const hasHeadings = document.querySelectorAll('h1, h2, h3, h4, h5, h6').length > 0;
        const hasLinks = document.querySelectorAll('a[href]').length > 0;
        const hasImages = document.querySelectorAll('img[src]').length > 0;
        
        // Check if React has actually rendered content (not just mounted)
        const hasSignificantContent = hasReactContent && (hasHeadings || hasLinks || hasImages);
        
        console.log(`SEO Sniffer: Attempt ${attempts} - Content check:`, {
          hasReactContent,
          hasHeadings,
          hasLinks,
          hasImages,
          hasSignificantContent
        });
        
        if (hasSignificantContent || attempts >= maxAttempts) {
          console.log('SEO Sniffer: React content detected, extracting data...');
          setTimeout(() => {
            const seoData = extractSeoData();
            console.log('SEO Sniffer: Extracted data:', seoData);
            sendData(seoData);
          }, 1000); // Extra delay for React hydration and async components
        } else {
          setTimeout(checkContent, 100);
        }
      }
      
      checkContent();
    }

    // Strategy 2: Listen for React Router changes
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
        }, 1000); // Wait for new page content to load
      }
    }

    // Strategy 3: Use MutationObserver for dynamic content
    function setupMutationObserver() {
      const observer = new MutationObserver((mutations) => {
        let significantChange = false;
        
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            for (let node of mutation.addedNodes) {
              if (node.nodeType === 1) { // Element node
                // Check for any SEO-relevant content
                const hasHeadings = node.tagName && ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(node.tagName);
                const hasLinks = node.tagName === 'A' && node.href;
                const hasImages = node.tagName === 'IMG' && node.src;
                const containsSeoContent = node.querySelector && node.querySelector('h1, h2, h3, h4, h5, h6, a[href], img[src]');
                
                if (hasHeadings || hasLinks || hasImages || containsSeoContent) {
                  significantChange = true;
                  console.log('SEO Sniffer: Significant DOM change detected:', node.tagName);
                  break;
                }
              }
            }
          }
        });

        if (significantChange) {
          clearTimeout(window.seoSnifferTimeout);
          window.seoSnifferTimeout = setTimeout(() => {
            console.log('SEO Sniffer: DOM changes settled, extracting data...');
            const seoData = extractSeoData();
            console.log('SEO Sniffer: Mutation observer extracted data:', seoData);
            sendData(seoData);
          }, 3000); // Longer debounce for React apps
        }
      });

      // Start observing after React root is available
      const rootElement = document.getElementById('root') || document.getElementById('app') || document.body;
      observer.observe(rootElement, {
        childList: true,
        subtree: true,
        attributes: false // Don't watch attribute changes to reduce noise
      });
      
      console.log('SEO Sniffer: MutationObserver setup complete, watching:', rootElement.tagName);
    }

    // Strategy 4: Listen for React 18 concurrent features
    function setupReact18Listener() {
      // Listen for React 18 concurrent rendering completion
      if (window.React && window.React.version && window.React.version.startsWith('18')) {
        console.log('SEO Sniffer: React 18 detected, using concurrent rendering strategy');
        
        // Use requestIdleCallback for React 18 concurrent features
        function checkAfterIdle() {
          if (window.requestIdleCallback) {
            window.requestIdleCallback(() => {
              setTimeout(() => {
                console.log('SEO Sniffer: React 18 idle callback triggered');
                const seoData = extractSeoData();
                if (seoData.headings.length > 0 || seoData.anchors.length > 0 || seoData.images.length > 0) {
                  console.log('SEO Sniffer: React 18 extracted data:', seoData);
                  sendData(seoData);
                }
              }, 500);
            }, { timeout: 5000 });
          }
        }
        
        // Multiple triggers for React 18
        setTimeout(checkAfterIdle, 2000);
        setTimeout(checkAfterIdle, 5000);
      }
    }

    // Initialize all strategies with delays
    function initAllStrategies() {
      console.log('SEO Sniffer: Initializing all React strategies...');
      waitForReactContent();
      setupRouteListener();
      setTimeout(() => setupMutationObserver(), 1000); // Delay observer setup
      setTimeout(() => setupReact18Listener(), 2000); // Delay React 18 listener
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initAllStrategies, 500); // Small delay after DOM ready
      });
    } else {
      setTimeout(initAllStrategies, 500); // Small delay if already loaded
    }
  }

  // Expose function for manual triggering (useful for React apps)
  window.seoSnifferExtractAndSend = function() {
    console.log('SEO Sniffer: Manual extraction triggered');
    const seoData = extractSeoData();
    sendData(seoData);
  };

  // Initialize the sniffer
  init();
  
  // Run auto-injection and crawling after a short delay to ensure DOM is ready
  setTimeout(() => {
    autoInjectIntoAllFiles();
    // Trigger automatic crawling after injection
    setTimeout(() => {
      autoCrawlProject();
    }, 3000); // Wait for injection to complete first
  }, 2000);

  // Only send data once on page load - no unload events to prevent tab switch issues
  let dataSent = false;
  
  // Mark that data has been sent to avoid duplicates
  function markDataSent() {
    dataSent = true;
    sessionStorage.setItem(`seo-sniffer-sent-${siteId}`, window.location.href);
  }
  
  // Check if data was already sent for this page in this session
  function wasDataSent() {
    return sessionStorage.getItem(`seo-sniffer-sent-${siteId}`) === window.location.href;
  }

})();
