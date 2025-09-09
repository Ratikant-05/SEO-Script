(function() {
  'use strict';

  // Configuration
  const config = {
    apiBaseUrl: window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1') 
      ? 'http://localhost:4444' 
      : 'https://your-production-api-url.com', // Replace with your production API URL
    maxPagesToScan: 10,
    autoStart: true,
    showUI: true
  };

  // Get site ID from script tag or generate one based on domain
  const scriptTag = document.querySelector('script[data-site-id]');
  const siteId = scriptTag ? scriptTag.getAttribute('data-site-id') : window.location.hostname.replace(/[^a-z0-9]/gi, '-');
  const userId = scriptTag ? scriptTag.getAttribute('data-user-id') : 'anonymous';

  // State management
  let state = {
    crawlInProgress: false,
    crawlCompleted: false,
    crawlSessionId: null,
    seoSuggestions: null,
    currentUrl: window.location.href,
    uiInitialized: false
  };

  // Initialize the tool
  function init() {
    console.log('SEO Auto Crawler: Initializing...');
    
    if (config.showUI) {
      initializeUI();
    }
    
    if (config.autoStart) {
      startCrawling();
    }
  }

  // Create and inject UI elements
  function initializeUI() {
    if (state.uiInitialized) return;
    
    // Create container
    const container = document.createElement('div');
    container.id = 'seo-auto-crawler-container';
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 300px;
      background-color: #fff;
      border-radius: 8px;
      box-shadow: 0 0 10px rgba(0,0,0,0.2);
      font-family: Arial, sans-serif;
      z-index: 9999;
      overflow: hidden;
      transition: all 0.3s ease;
    `;

    // Create header
    const header = document.createElement('div');
    header.style.cssText = `
      background-color: #4285f4;
      color: white;
      padding: 10px 15px;
      font-weight: bold;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
    `;
    header.innerHTML = `
      <span>SEO Auto Optimizer</span>
      <span id="seo-auto-crawler-toggle">−</span>
    `;
    container.appendChild(header);

    // Create content area
    const content = document.createElement('div');
    content.id = 'seo-auto-crawler-content';
    content.style.cssText = `
      padding: 15px;
      max-height: 400px;
      overflow-y: auto;
    `;
    content.innerHTML = `
      <div id="seo-auto-crawler-status">
        <p>Status: <span id="seo-status-text">Initializing...</span></p>
        <div id="seo-progress-bar" style="height: 5px; width: 0%; background-color: #4285f4; transition: width 0.3s;"></div>
      </div>
      <div id="seo-auto-crawler-suggestions" style="display: none; margin-top: 15px;">
        <h4 style="margin: 0 0 10px 0;">SEO Suggestions</h4>
        <div id="seo-suggestions-list"></div>
        <button id="seo-apply-changes" style="
          background-color: #4285f4;
          color: white;
          border: none;
          padding: 8px 15px;
          border-radius: 4px;
          margin-top: 10px;
          cursor: pointer;
        ">Apply Changes</button>
      </div>
    `;
    container.appendChild(content);

    // Append to body
    document.body.appendChild(container);

    // Add event listeners
    document.getElementById('seo-auto-crawler-toggle').addEventListener('click', togglePanel);
    document.getElementById('seo-apply-changes').addEventListener('click', applyChanges);

    state.uiInitialized = true;
  }

  // Toggle panel visibility
  function togglePanel() {
    const content = document.getElementById('seo-auto-crawler-content');
    const toggle = document.getElementById('seo-auto-crawler-toggle');
    
    if (content.style.display === 'none') {
      content.style.display = 'block';
      toggle.textContent = '−';
    } else {
      content.style.display = 'none';
      toggle.textContent = '+';
    }
  }

  // Update UI status
  function updateStatus(message, progress = null) {
    if (!config.showUI || !state.uiInitialized) return;
    
    const statusText = document.getElementById('seo-status-text');
    if (statusText) statusText.textContent = message;
    
    if (progress !== null) {
      const progressBar = document.getElementById('seo-progress-bar');
      if (progressBar) progressBar.style.width = `${progress}%`;
    }
  }

  // Start the crawling process
  async function startCrawling() {
    if (state.crawlInProgress) return;
    
    state.crawlInProgress = true;
    updateStatus('Starting crawl...', 10);
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/crawl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startUrl: state.currentUrl,
          maxPages: config.maxPagesToScan,
          siteId: siteId,
          userId: userId
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      const data = await response.json();
      state.crawlSessionId = data.sessionId;
      state.crawlCompleted = true;
      state.crawlInProgress = false;
      
      updateStatus(`Crawl completed! Scanned ${data.totalUrlsScraped} pages.`, 100);
      console.log('SEO Auto Crawler: Crawl completed', data);
      
      // Get SEO suggestions
      getSEOSuggestions();
      
    } catch (error) {
      state.crawlInProgress = false;
      updateStatus(`Error: ${error.message}`, 0);
      console.error('SEO Auto Crawler: Crawl failed', error);
    }
  }

  // Get SEO suggestions for the current page
  async function getSEOSuggestions() {
    if (!state.crawlCompleted) return;
    
    updateStatus('Getting SEO suggestions...', 50);
    
    try {
      // This endpoint would need to be implemented on your backend
      const response = await fetch(`${config.apiBaseUrl}/api/seo-suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: state.currentUrl,
          sessionId: state.crawlSessionId,
          siteId: siteId,
          userId: userId
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      const data = await response.json();
      state.seoSuggestions = data;
      
      updateStatus('SEO suggestions ready!', 100);
      displaySuggestions(data);
      
    } catch (error) {
      updateStatus(`Error getting suggestions: ${error.message}`, 0);
      console.error('SEO Auto Crawler: Failed to get suggestions', error);
    }
  }

  // Display SEO suggestions in the UI
  function displaySuggestions(suggestions) {
    if (!config.showUI || !state.uiInitialized) return;
    
    const suggestionsContainer = document.getElementById('seo-auto-crawler-suggestions');
    const suggestionsList = document.getElementById('seo-suggestions-list');
    
    if (!suggestionsContainer || !suggestionsList) return;
    
    suggestionsContainer.style.display = 'block';
    suggestionsList.innerHTML = '';
    
    // Process title suggestions
    if (suggestions.titleTagAnalysis) {
      const item = document.createElement('div');
      item.className = 'seo-suggestion-item';
      item.style.marginBottom = '10px';
      item.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px;">Title Tag</div>
        <div style="color: #777; margin-bottom: 5px;">Current: ${suggestions.titleTagAnalysis.current}</div>
        <div style="color: #4285f4;">Suggestion: ${suggestions.titleTagAnalysis.suggestion}</div>
      `;
      suggestionsList.appendChild(item);
    }
    
    // Process meta description suggestions
    if (suggestions.metaDescriptionAnalysis) {
      const item = document.createElement('div');
      item.className = 'seo-suggestion-item';
      item.style.marginBottom = '10px';
      item.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px;">Meta Description</div>
        <div style="color: #777; margin-bottom: 5px;">Current: ${suggestions.metaDescriptionAnalysis.current || 'None'}</div>
        <div style="color: #4285f4;">Suggestion: ${suggestions.metaDescriptionAnalysis.suggestion}</div>
      `;
      suggestionsList.appendChild(item);
    }
    
    // Process heading suggestions
    if (suggestions.headingsAnalysis && Array.isArray(suggestions.headingsAnalysis)) {
      suggestions.headingsAnalysis.forEach((heading, index) => {
        const item = document.createElement('div');
        item.className = 'seo-suggestion-item';
        item.style.marginBottom = '10px';
        item.innerHTML = `
          <div style="font-weight: bold; margin-bottom: 5px;">Heading (${heading.level || 'H1'})</div>
          <div style="color: #777; margin-bottom: 5px;">Current: ${heading.current}</div>
          <div style="color: #4285f4;">Suggestion: ${heading.suggestion}</div>
        `;
        suggestionsList.appendChild(item);
      });
    }
    
    // Process paragraph suggestions
    if (suggestions.paragraphAnalysis && Array.isArray(suggestions.paragraphAnalysis)) {
      suggestions.paragraphAnalysis.forEach((para, index) => {
        if (index > 2) return; // Limit to first 3 paragraphs to avoid UI clutter
        
        const item = document.createElement('div');
        item.className = 'seo-suggestion-item';
        item.style.marginBottom = '10px';
        item.innerHTML = `
          <div style="font-weight: bold; margin-bottom: 5px;">Paragraph ${index + 1}</div>
          <div style="color: #777; margin-bottom: 5px; max-height: 60px; overflow: hidden;">Current: ${para.current.substring(0, 100)}${para.current.length > 100 ? '...' : ''}</div>
          <div style="color: #4285f4; max-height: 60px; overflow: hidden;">Suggestion: ${para.suggestion.substring(0, 100)}${para.suggestion.length > 100 ? '...' : ''}</div>
        `;
        suggestionsList.appendChild(item);
      });
      
      if (suggestions.paragraphAnalysis.length > 3) {
        const moreItem = document.createElement('div');
        moreItem.style.color = '#777';
        moreItem.textContent = `+ ${suggestions.paragraphAnalysis.length - 3} more paragraph suggestions`;
        suggestionsList.appendChild(moreItem);
      }
    }
    
    // Process image suggestions
    if (suggestions.imageAnalysis && Array.isArray(suggestions.imageAnalysis)) {
      suggestions.imageAnalysis.forEach((img, index) => {
        if (index > 2) return; // Limit to first 3 images to avoid UI clutter
        
        const item = document.createElement('div');
        item.className = 'seo-suggestion-item';
        item.style.marginBottom = '10px';
        item.innerHTML = `
          <div style="font-weight: bold; margin-bottom: 5px;">Image Alt Text ${index + 1}</div>
          <div style="color: #777; margin-bottom: 5px;">Current: ${img.currentAlt || 'None'}</div>
          <div style="color: #4285f4;">Suggestion: ${img.altSuggestion}</div>
        `;
        suggestionsList.appendChild(item);
      });
      
      if (suggestions.imageAnalysis.length > 3) {
        const moreItem = document.createElement('div');
        moreItem.style.color = '#777';
        moreItem.textContent = `+ ${suggestions.imageAnalysis.length - 3} more image suggestions`;
        suggestionsList.appendChild(moreItem);
      }
    }
  }

  // Apply the suggested changes
  async function applyChanges() {
    if (!state.seoSuggestions) return;
    
    updateStatus('Applying changes...', 50);
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/applyChanges`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: state.currentUrl,
          changes: state.seoSuggestions
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      const data = await response.json();
      
      updateStatus('Changes applied successfully!', 100);
      console.log('SEO Auto Crawler: Changes applied', data);
      
      // Show preview or reload page with changes
      if (data.modifiedHtml) {
        showPreview(data.modifiedHtml);
      }
      
    } catch (error) {
      updateStatus(`Error applying changes: ${error.message}`, 0);
      console.error('SEO Auto Crawler: Failed to apply changes', error);
    }
  }

  // Show a preview of the changes
  function showPreview(html) {
    // Create modal for preview
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0,0,0,0.8);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background-color: white;
      width: 80%;
      height: 80%;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;
    
    const modalHeader = document.createElement('div');
    modalHeader.style.cssText = `
      padding: 15px;
      background-color: #4285f4;
      color: white;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    modalHeader.innerHTML = `
      <h3 style="margin: 0;">SEO Changes Preview</h3>
      <button id="close-preview" style="
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
      ">×</button>
    `;
    
    const iframe = document.createElement('iframe');
    iframe.style.cssText = `
      flex: 1;
      width: 100%;
      border: none;
    `;
    
    const modalFooter = document.createElement('div');
    modalFooter.style.cssText = `
      padding: 15px;
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #eee;
    `;
    modalFooter.innerHTML = `
      <button id="cancel-changes" style="
        background-color: #f1f1f1;
        border: none;
        padding: 8px 15px;
        border-radius: 4px;
        cursor: pointer;
      ">Cancel</button>
      <button id="apply-to-live" style="
        background-color: #4285f4;
        color: white;
        border: none;
        padding: 8px 15px;
        border-radius: 4px;
        cursor: pointer;
      ">Apply to Live Site</button>
    `;
    
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(iframe);
    modalContent.appendChild(modalFooter);
    modal.appendChild(modalContent);
    
    document.body.appendChild(modal);
    
    // Set iframe content
    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(html);
    iframe.contentWindow.document.close();
    
    // Add event listeners
    document.getElementById('close-preview').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    document.getElementById('cancel-changes').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    document.getElementById('apply-to-live').addEventListener('click', () => {
      // Here you would implement the actual saving of changes to the live site
      // This would typically involve server-side file modifications
      alert('Changes would now be applied to the live site. This feature requires server-side implementation.');
      document.body.removeChild(modal);
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();