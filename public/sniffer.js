(function() {
  'use strict';

  // Get site ID and file path from script tag
  const scriptTag = document.querySelector('script[data-site-id]');
  const siteId = scriptTag ? scriptTag.getAttribute('data-site-id') : null;

  if (!siteId) {
    console.warn('SEO Sniffer: No site ID found');
    return;
  }

  // React/SPA detection and handling
  let isReactApp = false;
  let isSPA = false;
  
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
  
  // Detect if this is a Single Page Application (including hash routing)
  function detectSPA() {
    // Check for common SPA indicators
    const hasHashRouting = window.location.hash.length > 1;
    const hasAngular = !!(window.angular || window.ng);
    const hasVue = !!(window.Vue);
    const hasEmber = !!(window.Ember);
    const hasBackbone = !!(window.Backbone);
    
    // Check for common SPA routing libraries
    const hasRouter = !!(window.Router || window.VueRouter || window.ReactRouter);
    
    return hasHashRouting || isReactApp || hasAngular || hasVue || hasEmber || hasBackbone || hasRouter;
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
  isSPA = detectSPA();
  
  console.log('SEO Sniffer: App type detection:', { isReactApp, isSPA });
  
  // If not detected initially, wait for React to load
  if (!isReactApp) {
    waitForReactDetection();
  }
  
  // DOM-based SEO optimization functions
  const seoOptimizer = {
    // Store original values for reverting changes
    originalValues: new Map(),
    
    // Apply SEO optimization to DOM
    applyOptimization(instruction) {
      const { type, element, domAction, currentValue, suggestedValue } = instruction;
      
      try {
        switch (type) {
          case 'title':
            this.originalValues.set('title', document.title);
            document.title = suggestedValue;
            this.showOptimizationNotification('Title optimized for SEO', 'success');
            break;
            
          case 'meta_description':
            let metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) {
              this.originalValues.set('meta_description', metaDesc.getAttribute('content'));
              metaDesc.setAttribute('content', suggestedValue);
            } else {
              // Create new meta description
              metaDesc = document.createElement('meta');
              metaDesc.setAttribute('name', 'description');
              metaDesc.setAttribute('content', suggestedValue);
              document.head.appendChild(metaDesc);
              this.originalValues.set('meta_description', null);
            }
            this.showOptimizationNotification('Meta description optimized', 'success');
            break;
            
          case 'heading':
            const headingElement = document.querySelector(element);
            if (headingElement) {
              this.originalValues.set(`heading_${element}`, headingElement.textContent);
              headingElement.textContent = suggestedValue;
              this.showOptimizationNotification(`${element.toUpperCase()} heading optimized`, 'success');
            }
            break;
            
          case 'alt_text':
            const imgElement = document.querySelector(element);
            if (imgElement) {
              this.originalValues.set(`alt_${element}`, imgElement.getAttribute('alt'));
              imgElement.setAttribute('alt', suggestedValue);
              this.showOptimizationNotification('Image alt text optimized', 'success');
            }
            break;
            
          case 'content':
            const contentElement = document.querySelector(element);
            if (contentElement) {
              this.originalValues.set(`content_${element}`, contentElement.textContent);
              if (domAction === 'replace') {
                contentElement.textContent = suggestedValue;
              } else if (domAction === 'append') {
                contentElement.textContent += ' ' + suggestedValue;
              }
              this.showOptimizationNotification('Content optimized for SEO', 'success');
            }
            break;
            
          case 'link':
            const linkElement = document.querySelector(element);
            if (linkElement) {
              this.originalValues.set(`link_${element}`, linkElement.textContent);
              linkElement.textContent = suggestedValue;
              this.showOptimizationNotification('Link text optimized', 'success');
            }
            break;
        }
        
        // Store optimization in session for persistence
        this.storeOptimization(instruction);
        
      } catch (error) {
        console.error('SEO Optimizer: Failed to apply optimization', error);
        this.showOptimizationNotification('Failed to apply optimization', 'error');
      }
    },
    
    // Revert all optimizations
    revertOptimizations() {
      try {
        // Revert title
        if (this.originalValues.has('title')) {
          document.title = this.originalValues.get('title');
        }
        
        // Revert meta description
        if (this.originalValues.has('meta_description')) {
          const metaDesc = document.querySelector('meta[name="description"]');
          const originalValue = this.originalValues.get('meta_description');
          if (originalValue === null && metaDesc) {
            // Remove if it was added
            metaDesc.remove();
          } else if (metaDesc && originalValue) {
            metaDesc.setAttribute('content', originalValue);
          }
        }
        
        // Revert other elements
        this.originalValues.forEach((originalValue, key) => {
          if (key.startsWith('heading_')) {
            const selector = key.replace('heading_', '');
            const element = document.querySelector(selector);
            if (element) element.textContent = originalValue;
          } else if (key.startsWith('alt_')) {
            const selector = key.replace('alt_', '');
            const element = document.querySelector(selector);
            if (element) element.setAttribute('alt', originalValue || '');
          } else if (key === 'meta_description') {
            let metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) {
              metaDesc.setAttribute('content', originalValue);
            }
          } else if (key.startsWith('heading_')) {
            const level = key.split('_')[1];
            const heading = document.querySelector(`h${level}`);
            if (heading) {
              heading.textContent = originalValue;
            }
          } else if (key === 'custom_h1') {
            const h1Element = document.querySelector('h1');
            if (h1Element) {
              h1Element.textContent = originalValue;
              // Remove from localStorage
              const persistenceKey = `seo_h1_${window.location.pathname}`;
              localStorage.removeItem(persistenceKey);
            }
          }
        });
        
        this.originalValues.clear();
        sessionStorage.removeItem(`seo_optimizations_${siteId}`);
        this.showOptimizationNotification('All optimizations reverted', 'success');
        
      } catch (error) {
        console.error('SEO Optimizer: Failed to revert optimizations', error);
      }
    },
    
    // Store optimization in session storage
    storeOptimization(instruction) {
      const optimizations = JSON.parse(sessionStorage.getItem(`seo_optimizations_${siteId}`) || '[]');
      optimizations.push({
        ...instruction,
        appliedAt: new Date().toISOString()
      });
      sessionStorage.setItem(`seo_optimizations_${siteId}`, JSON.stringify(optimizations));
    },
    
    // Show optimization notification
    showOptimizationNotification(message, type = 'success') {
      // Remove existing notification
      const existing = document.getElementById('seo-optimization-notification');
      if (existing) existing.remove();
      
      const notification = document.createElement('div');
      notification.id = 'seo-optimization-notification';
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        max-width: 300px;
        animation: slideIn 0.3s ease-out;
      `;
      
      notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
          <span>${message}</span>
        </div>
      `;
      
      // Add animation styles
      if (!document.getElementById('seo-notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'seo-notification-styles';
        styles.textContent = `
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `;
        document.head.appendChild(styles);
      }
      
      document.body.appendChild(notification);
      
      // Auto-remove after 3 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.style.animation = 'slideIn 0.3s ease-out reverse';
          setTimeout(() => notification.remove(), 300);
        }
      }, 3000);
    },
    
    // Control panel functionality moved to dashboard - no longer injected via sniffer
    createControlPanel() {
      // Control panel is now part of the main dashboard
      console.log('SEO Control Panel is available in the main dashboard');
    },
    
    // Get SEO suggestions from server
    async getSeoSuggestions() {
      const button = document.getElementById('seo-get-suggestions');
      const container = document.getElementById('seo-suggestions-container');
      
      button.textContent = 'Analyzing...';
      button.disabled = true;
      
      try {
        const response = await fetch(`https://seo-script-hqz1.onrender.com/api/sites/${siteId}/analyze`, {
          method: 'POST'
        });
        
        const data = await response.json();
        
        if (response.ok) {
          this.displaySuggestions(data);
        } else {
          this.showOptimizationNotification('Failed to get SEO suggestions', 'error');
        }
        
      } catch (error) {
        console.error('Failed to get SEO suggestions:', error);
        this.showOptimizationNotification('Network error getting suggestions', 'error');
      } finally {
        button.textContent = 'Get SEO Suggestions';
        button.disabled = false;
      }
    },
    
    // Display suggestions in control panel
    displaySuggestions(analysisData) {
      const container = document.getElementById('seo-suggestions-container');
      const { seoScore, criticalIssues, suggestions } = analysisData;
      
      container.innerHTML = `
        <div style="margin-bottom: 10px; padding: 8px; background: #f5f5f5; border-radius: 6px;">
          <strong>SEO Score: ${seoScore}/100</strong>
          ${criticalIssues.length ? `<br><span style="color: #f44336;">Critical Issues: ${criticalIssues.length}</span>` : ''}
        </div>
      `;
      
      suggestions.forEach((suggestion, index) => {
        const suggestionDiv = document.createElement('div');
        suggestionDiv.style.cssText = `
          margin-bottom: 8px;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 6px;
          background: #fafafa;
        `;
        
        const priorityColor = {
          critical: '#f44336',
          high: '#ff9800', 
          medium: '#2196F3',
          low: '#4CAF50'
        }[suggestion.priority] || '#666';
        
        suggestionDiv.innerHTML = `
          <div style="font-weight: bold; color: ${priorityColor}; margin-bottom: 4px;">
            ${suggestion.priority.toUpperCase()}: ${suggestion.type.replace('_', ' ').toUpperCase()}
          </div>
          <div style="font-size: 11px; margin-bottom: 6px;">${suggestion.issue}</div>
          <div style="font-size: 11px; margin-bottom: 6px; color: #666;">${suggestion.suggestion}</div>
          <button onclick="seoOptimizer.applyOptimization(${JSON.stringify(suggestion).replace(/"/g, '&quot;')})" style="
            padding: 4px 8px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 10px;
          ">Apply Fix</button>
        `;
        
        container.appendChild(suggestionDiv);
      });
    },
    
    // Update H1 with custom Gemini request
    async updateH1WithGemini() {
      const input = document.getElementById('custom-h1-input');
      const button = document.getElementById('update-h1-btn');
      const userRequest = input.value.trim();
      
      if (!userRequest) {
        this.showOptimizationNotification('Please enter your H1 update request', 'error');
        return;
      }
      
      button.textContent = 'Processing...';
      button.disabled = true;
      
      try {
        // Get current H1 content
        const currentH1 = document.querySelector('h1');
        const currentH1Text = currentH1 ? currentH1.textContent.trim() : 'No H1 found';
        
        const response = await fetch(`https://seo-script-hqz1.onrender.com/api/sites/${siteId}/custom-h1`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userRequest,
            currentH1: currentH1Text,
            pageUrl: window.location.href,
            pageTitle: document.title
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.optimizedH1) {
          // Apply the optimized H1
          if (currentH1) {
            this.originalValues.set('custom_h1', currentH1.textContent);
            currentH1.textContent = data.optimizedH1;
            this.showOptimizationNotification(`H1 updated: "${data.optimizedH1}"`, 'success');
            
            // Save to localStorage for persistence across page refreshes
            const persistenceKey = `seo_h1_${window.location.pathname}`;
            localStorage.setItem(persistenceKey, JSON.stringify({
              optimizedH1: data.optimizedH1,
              originalH1: currentH1Text,
              timestamp: Date.now(),
              userRequest: userRequest
            }));
            
            // Store the optimization
            this.storeOptimization({
              type: 'heading',
              element: 'h1',
              domAction: 'replace',
              currentValue: currentH1Text,
              suggestedValue: data.optimizedH1,
              seoImpact: data.explanation || 'Custom H1 optimization',
              userRequest: userRequest
            });
          } else {
            this.showOptimizationNotification('No H1 element found on page', 'error');
          }
          
          // Clear input
          input.value = '';
        } else {
          this.showOptimizationNotification(data.error || 'Failed to optimize H1', 'error');
        }
        
      } catch (error) {
        console.error('Failed to update H1:', error);
        this.showOptimizationNotification('Network error updating H1', 'error');
      } finally {
        button.textContent = 'Update H1 with Gemini';
        button.disabled = false;
      }
    }
  };
  
  // Make seoOptimizer globally accessible
  window.seoOptimizer = seoOptimizer;
  
  // Global function to fetch all anchor tags
  window.getAllAnchorTags = function() {
    const anchors = document.querySelectorAll('a');
    const anchorData = [];
    
    anchors.forEach((anchor, index) => {
      const href = anchor.getAttribute('href');
      const text = anchor.textContent.trim();
      const title = anchor.getAttribute('title') || '';
      const target = anchor.getAttribute('target') || '';
      const rel = anchor.getAttribute('rel') || '';
      const className = anchor.className || '';
      const id = anchor.id || '';
      
      // Determine link type
      let linkType = 'internal';
      if (href) {
        if (href.startsWith('http') && !href.includes(window.location.hostname)) {
          linkType = 'external';
        } else if (href.startsWith('mailto:')) {
          linkType = 'email';
        } else if (href.startsWith('tel:')) {
          linkType = 'phone';
        } else if (href.startsWith('#')) {
          linkType = 'anchor';
        }
      } else {
        linkType = 'no-href';
      }
      
      anchorData.push({
        index: index + 1,
        element: anchor,
        href: href || '',
        text: text,
        title: title,
        target: target,
        rel: rel,
        className: className,
        id: id,
        linkType: linkType,
        hasText: text.length > 0,
        isEmpty: text.length === 0,
        wordCount: text.split(/\s+/).filter(word => word.length > 0).length,
        isVisible: anchor.offsetParent !== null,
        boundingRect: anchor.getBoundingClientRect()
      });
    });
    
    console.log(`Found ${anchorData.length} anchor tags:`, anchorData);
    return anchorData;
  };
  
  // Restore persisted H1 changes on page load
  function restorePersistedH1() {
    const persistenceKey = `seo_h1_${window.location.pathname}`;
    const savedData = localStorage.getItem(persistenceKey);
    
    console.log('SEO: Checking for persisted H1 data...', { persistenceKey, savedData });
    
    if (savedData) {
      try {
        const { optimizedH1, originalH1, timestamp } = JSON.parse(savedData);
        
        console.log('SEO: Found persisted H1 data:', { optimizedH1, originalH1, timestamp });
        
        // Check if data is not too old (24 hours)
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          const h1Element = document.querySelector('h1');
          const currentH1Text = h1Element ? h1Element.textContent.trim() : null;
          
          console.log('SEO: Current H1 vs Original:', { currentH1Text, originalH1 });
          
          if (h1Element) {
            // Apply optimized H1 regardless of current content to ensure it works
            h1Element.textContent = optimizedH1;
            seoOptimizer.originalValues.set('custom_h1', originalH1);
            console.log('SEO: H1 restored successfully to:', optimizedH1);
          } else {
            console.log('SEO: No H1 element found on page');
          }
        } else {
          console.log('SEO: Persisted H1 data expired, removing...');
          localStorage.removeItem(persistenceKey);
        }
      } catch (error) {
        console.error('SEO: Error restoring H1:', error);
        localStorage.removeItem(persistenceKey);
      }
    } else {
      console.log('SEO: No persisted H1 data found');
    }
  }
  
  // Create control panel when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        restorePersistedH1();
        seoOptimizer.createControlPanel();
      }, 500);
    });
  } else {
    setTimeout(() => {
      restorePersistedH1();
      seoOptimizer.createControlPanel();
    }, 500);
  }

})();
