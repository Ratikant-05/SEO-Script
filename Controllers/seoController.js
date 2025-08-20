import Site from '../Models/Site.js';
import SeoSnapshot from '../Models/SeoSnapshot.js';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs/promises';
import axios from 'axios';
import { JSDOM } from 'jsdom';

// Server-side SEO data extraction function using JSDOM
function extractSeoDataFromHtml(htmlContent, filePath, baseUrl = '') {
  const dom = new JSDOM(htmlContent);
  const document = dom.window.document;
  
  const data = {
    title: '',
    headings: [],
    anchors: [],
    metaDescription: '',
    metaTags: [],
    images: [],
    paragraphs: [],
    divs: []
  };

  // Extract title
  data.title = document.title || '';

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
      href: anchor.getAttribute('href') || '',
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

  // Extract images with src and alt
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
    if (src) {
      data.images.push({
        src: src,
        alt: img.getAttribute('alt') || ''
      });
    }
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

  // Extract divs with text content (including spans)
  const divs = document.querySelectorAll('div');
  divs.forEach(div => {
    const fullText = div.textContent.trim();
    
    // Get text from spans within this div
    const spans = div.querySelectorAll('span');
    const spanText = Array.from(spans).map(span => span.textContent.trim()).join(' ').trim();
    
    if (fullText && fullText.length > 5) {
      // Avoid duplicates by checking if this text is already captured
      const isRedundant = data.divs.some(existingDiv => 
        existingDiv.text.includes(fullText) || fullText.includes(existingDiv.text)
      );
      
      if (!isRedundant) {
        const spanCount = spans.length;
        data.divs.push({
          text: fullText,
          length: fullText.length,
          className: div.className || '',
          id: div.id || '',
          hasSpans: spanCount > 0,
          spanCount: spanCount,
          spanText: spanText
        });
      }
    }
  });

  return data;
}

// Scrape external URL using Axios and Cheerio
async function scrapeUrlData(url) {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    return extractSeoDataFromHtml(response.data, null, url);
  } catch (error) {
    throw new Error(`Failed to scrape URL: ${error.message}`);
  }
}

// Collect SEO data from client
export const collectSeoData = async (req, res) => {
  try {
    const { siteId, url, data, filePath } = req.body;

    if (!siteId || !url || !data) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify site exists
    const site = await Site.findOne({ siteId });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Create new SEO snapshot
    const seoSnapshot = new SeoSnapshot({
      siteId,
      url,
      data,
      filePath
    });

    await seoSnapshot.save();
    res.status(201).json({ message: 'SEO data collected successfully' });
  } catch (error) {
    console.error('Error collecting SEO data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Register a new site
export const registerSite = async (req, res) => {
  try {
    console.log('Received request body:', req.body);
    const { name, domain } = req.body;

    if (!name || !domain) {
      console.log('Missing fields - name:', name, 'domain:', domain);
      return res.status(400).json({ error: 'Name and domain are required' });
    }

    // Domain validation
    const domainRegex = /^(localhost(:\d+)?|127\.0\.0\.1(:\d+)?|(\d{1,3}\.){3}\d{1,3}(:\d+)?|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|https?:\/\/.+)$/;
    if (!domainRegex.test(domain)) {
      console.log('Domain validation failed for:', domain);
      return res.status(400).json({ error: 'Invalid domain format. Use: example.com, localhost, or IP address' });
    }

    // Check if domain is already registered
    const existingSite = await Site.findOne({ domain });
    if (existingSite) {
      // Generate script URL based on environment
      const isProduction = req.get('host') !== 'localhost:4444' && !req.get('host').includes('127.0.0.1');
      const scriptSrc = isProduction ? 
        `https://seo-script-hqz1.onrender.com/sniffer.js` : 
        `http://localhost:4444/sniffer.js`;
      const installSnippet = `<script defer src="${scriptSrc}" data-site-id="${existingSite.siteId}"></script>`;
      
      return res.status(200).json({
        siteId: existingSite.siteId,
        name: existingSite.name,
        domain: existingSite.domain,
        installSnippet,
        message: 'Site already registered',
        alreadyRegistered: true,
        registeredAt: existingSite.createdAt
      });
    }

    const siteId = crypto.randomUUID();
    
    const site = new Site({
      siteId,
      name,
      domain
    });

    await site.save();

    // Generate script URL based on environment
    const isProduction = req.get('host') !== 'localhost:4444' && !req.get('host').includes('127.0.0.1');
    const scriptSrc = isProduction ? 
      `https://seo-script-hqz1.onrender.com/sniffer.js` : 
      `http://localhost:4444/sniffer.js`;
    const installSnippet = `<script defer src="${scriptSrc}" data-site-id="${siteId}"></script>`;

    res.status(201).json({
      siteId,
      name,
      domain,
      installSnippet,
      message: 'Site registered successfully',
      alreadyRegistered: false
    });
  } catch (error) {
    console.error('Error registering site:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get collected SEO data for a site
export const getSitePages = async (req, res) => {
  try {
    const { siteId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Verify site exists
    const site = await Site.findOne({ siteId });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const snapshots = await SeoSnapshot.find({ siteId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await SeoSnapshot.countDocuments({ siteId });

    res.json({
      site: {
        siteId: site.siteId,
        name: site.name,
        domain: site.domain
      },
      snapshots,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > parseInt(offset) + parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching SEO data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Auto-inject script tag into all HTML files in project
export const autoInjectScript = async (req, res) => {
  try {
    const { siteId } = req.params;
    const { projectPath, excludeFiles = [] } = req.body;

    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }

    // Verify site exists
    const site = await Site.findOne({ siteId });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Generate script tag with environment detection
    const isProduction = req.get('host') !== 'localhost:4444' && !req.get('host').includes('127.0.0.1');
    const scriptSrc = isProduction ? 
      `https://seo-script-hqz1.onrender.com/sniffer.js` : 
      `http://localhost:4444/sniffer.js`;
    
    const scriptTag = `<script defer src="${scriptSrc}" data-site-id="${siteId}"></script>`;
    
    // Find all HTML and HBS files recursively
    function findHtmlFiles(dir, fileList = []) {
        const files = fs.readdirSync(dir);
        
        files.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory()) {
                // Skip excluded directories
                if (!excludeFiles.some(exclude => file.includes(exclude))) {
                    findHtmlFiles(filePath, fileList);
                }
            } else if (file.endsWith('.html') || file.endsWith('.hbs')) {
                fileList.push(filePath);
            }
        });
        
        return fileList;
    }

    // Inject script into HTML file
    async function injectScript(filePath) {
      try {
        let content = await fs.readFile(filePath, 'utf-8');
        
        // Check if script already exists
        if (content.includes(`data-site-id="${siteId}"`)) {
          return { success: true, action: 'skipped', reason: 'Script already exists' };
        }
        
        // Find head tag and inject script
        const headMatch = content.match(/(<head[^>]*>)/i);
        if (headMatch) {
          const insertPosition = headMatch.index + headMatch[0].length;
          content = content.slice(0, insertPosition) + 
                   `\n    ${scriptTag}` + 
                   content.slice(insertPosition);
          
          await fs.writeFile(filePath, content, 'utf-8');
          return { success: true, action: 'injected' };
        } else {
          return { success: false, reason: 'No <head> tag found' };
        }
      } catch (error) {
        return { success: false, reason: error.message };
      }
    }

    // Process all HTML files
    const htmlFiles = findHtmlFiles(projectPath);
    const results = [];
    
    for (const filePath of htmlFiles) {
      const relativePath = path.relative(projectPath, filePath);
      
      // Skip excluded files
      if (excludeFiles.some(exclude => relativePath.includes(exclude))) {
        results.push({
          file: relativePath,
          success: true,
          action: 'skipped',
          reason: 'File excluded'
        });
        continue;
      }
      
      const result = await injectScript(filePath);
      results.push({
        file: relativePath,
        ...result
      });
    }

    const summary = {
      total: results.length,
      injected: results.filter(r => r.action === 'injected').length,
      skipped: results.filter(r => r.action === 'skipped').length,
      failed: results.filter(r => !r.success).length
    };

    res.json({
      message: 'Auto-injection completed',
      summary,
      results,
      scriptTag
    });

  } catch (error) {
    console.error('Error during auto-injection:', error);
    res.status(500).json({ error: 'Failed to auto-inject scripts' });
  }
};

// Crawl all HTML files in project and extract SEO data
export const crawlProject = async (req, res) => {
  try {
    const { siteId } = req.params;
    const { projectPath, excludeFiles = ['node_modules', 'dist', 'build', '.git', 'bower_components'] } = req.body;

    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }

    // Verify site exists
    const site = await Site.findOne({ siteId });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Find all HTML files recursively
    async function findHtmlFiles(dir, fileList = []) {
      try {
        const files = await fs.readdir(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = await fs.stat(filePath);
          
          if (stat.isDirectory()) {
            // Skip excluded directories
            if (!excludeFiles.some(exclude => file.includes(exclude))) {
              await findHtmlFiles(filePath, fileList);
            }
          } else if (file.endsWith('.html') || file.endsWith('.hbs')) {
            fileList.push(filePath);
          }
        }
      } catch (error) {
        console.warn(`Could not read directory ${dir}:`, error.message);
      }
      
      return fileList;
    }

    // Process each HTML file
    async function processHtmlFile(filePath) {
      try {
        const htmlContent = await fs.readFile(filePath, 'utf-8');
        const relativePath = path.relative(projectPath, filePath);
        
        // Generate URL based on file path
        const url = `file:///${filePath.replace(/\\/g, '/')}`;
        
        // Extract SEO data
        const seoData = extractSeoDataFromHtml(htmlContent, filePath);
        
        // Check if we already have recent data for this file
        const existingSnapshot = await SeoSnapshot.findOne({
          siteId,
          filePath,
          createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // 5 minutes ago
        });

        if (existingSnapshot) {
          return {
            file: relativePath,
            action: 'skipped',
            reason: 'Recent data exists',
            data: seoData
          };
        }

        // Save to database
        const seoSnapshot = new SeoSnapshot({
          siteId,
          url,
          data: seoData,
          filePath
        });

        await seoSnapshot.save();

        return {
          file: relativePath,
          action: 'processed',
          data: seoData,
          url
        };
      } catch (error) {
        return {
          file: path.relative(projectPath, filePath),
          action: 'failed',
          error: error.message
        };
      }
    }

    console.log(`Starting crawl for site ${siteId} in ${projectPath}`);
    
    // Find all HTML files
    const htmlFiles = await findHtmlFiles(projectPath);
    console.log(`Found ${htmlFiles.length} HTML files to process`);

    // Process all files
    const results = [];
    for (const filePath of htmlFiles) {
      const result = await processHtmlFile(filePath);
      results.push(result);
      console.log(`Processed: ${result.file} - ${result.action}`);
    }

    const summary = {
      total: results.length,
      processed: results.filter(r => r.action === 'processed').length,
      skipped: results.filter(r => r.action === 'skipped').length,
      failed: results.filter(r => r.action === 'failed').length
    };

    console.log('Crawl completed:', summary);

    res.json({
      message: 'Project crawl completed',
      summary,
      results: results.map(r => ({
        file: r.file,
        action: r.action,
        reason: r.reason,
        error: r.error,
        headingsCount: r.data?.headings?.length || 0,
        linksCount: r.data?.anchors?.length || 0,
        imagesCount: r.data?.images?.length || 0,
        paragraphsCount: r.data?.paragraphs?.length || 0,
        divsCount: r.data?.divs?.length || 0,
        hasMetaDescription: !!r.data?.metaDescription
      }))
    });

  } catch (error) {
    console.error('Error during project crawl:', error);
    res.status(500).json({ error: 'Failed to crawl project' });
  }
};

// Analyze SEO data and get suggestions from Gemini
export const analyzeSeoData = async (req, res) => {
  try {
    const { siteId } = req.params;
    
    // Get site and latest snapshot
    const site = await Site.findOne({ siteId });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const latestSnapshot = await SeoSnapshot.findOne({ siteId })
      .sort({ createdAt: -1 });
    
    if (!latestSnapshot) {
      return res.status(404).json({ error: 'No SEO data found for this site' });
    }

    // Prepare data for Gemini analysis
    const seoData = latestSnapshot.data;
    const analysisPrompt = `
You are an expert SEO consultant. Analyze this website's SEO data and provide specific, actionable suggestions for real-time DOM optimization.

WEBSITE ANALYSIS:
Page URL: ${latestSnapshot.url}
Site: ${site.name} (${site.domain})

CURRENT SEO ELEMENTS:
Title: ${seoData.title || 'MISSING TITLE'}

HEADINGS STRUCTURE:
${seoData.headings.map(h => `${h.tag.toUpperCase()}: "${h.text}"`).join('\n')}

META DESCRIPTION: ${seoData.metaDescription || 'MISSING - Critical SEO issue!'}

META TAGS:
${seoData.metaTags.map(m => `${m.name || m.property}: "${m.content}"`).join('\n')}

IMAGES (${seoData.images.length} total):
${seoData.images.map(img => `- Src: ${img.src} | Alt: ${img.alt || 'MISSING ALT TEXT - SEO issue!'}`).join('\n')}

LINKS (${seoData.anchors.length} total):
${seoData.anchors.slice(0, 10).map(a => `- "${a.text || 'NO ANCHOR TEXT'}" -> ${a.href}`).join('\n')}

CONTENT ANALYSIS:
Paragraphs: ${seoData.paragraphs?.length || 0}
Content Divs: ${seoData.divs?.length || 0}

Provide detailed SEO optimization suggestions that can be applied via DOM manipulation. Focus on:
1. Title optimization for search engines
2. Meta description improvements 
3. Heading structure optimization (H1 should be unique, H2-H6 hierarchy)
4. Image alt text for accessibility and SEO
5. Content improvements for better keyword targeting
6. Internal linking optimization

Return suggestions in this exact JSON format:
{
  "seoScore": "score out of 100",
  "criticalIssues": ["list of critical SEO problems"],
  "suggestions": [
    {
      "type": "title|meta_description|heading|alt_text|content|link",
      "priority": "critical|high|medium|low",
      "issue": "Detailed explanation of the SEO issue",
      "suggestion": "Specific actionable recommendation",
      "currentValue": "current content",
      "suggestedValue": "SEO-optimized content",
      "element": "CSS selector for target element",
      "domAction": "replace|append|setAttribute|addClass",
      "seoImpact": "explanation of SEO benefit",
      "keywords": ["relevant", "keywords", "for", "optimization"]
    }
  ]
}

Provide 10-15 comprehensive suggestions covering all major SEO aspects. Be specific about DOM selectors and optimization strategies.`;

    // Call Gemini API
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: analysisPrompt
          }]
        }]
      })
    });

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const analysisText = geminiData.candidates[0].content.parts[0].text;
    
    // Parse JSON from Gemini response
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse suggestions from Gemini response');
    }

    const suggestions = JSON.parse(jsonMatch[0]);

    res.json({
      site: {
        siteId: site.siteId,
        name: site.name,
        domain: site.domain
      },
      snapshot: {
        url: latestSnapshot.url,
        createdAt: latestSnapshot.createdAt
      },
      seoScore: suggestions.seoScore || 'Not calculated',
      criticalIssues: suggestions.criticalIssues || [],
      suggestions: suggestions.suggestions
    });

  } catch (error) {
    console.error('Error analyzing SEO data:', error);
    res.status(500).json({ error: 'Failed to analyze SEO data' });
  }
};

// Apply DOM-based SEO optimization (sends commands to client)
export const applySuggestion = async (req, res) => {
  try {
    const { siteId } = req.params;
    const { suggestion } = req.body;

    if (!suggestion) {
      return res.status(400).json({ error: 'Suggestion is required' });
    }

    // Verify site exists
    const site = await Site.findOne({ siteId });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Return DOM manipulation instructions for the client
    res.json({
      message: 'DOM optimization instructions ready',
      siteId,
      domInstructions: {
        type: suggestion.type,
        element: suggestion.element,
        domAction: suggestion.domAction,
        currentValue: suggestion.currentValue,
        suggestedValue: suggestion.suggestedValue,
        seoImpact: suggestion.seoImpact,
        keywords: suggestion.keywords
      }
    });

  } catch (error) {
    console.error('Error preparing DOM optimization:', error);
    res.status(500).json({ error: 'Failed to prepare optimization' });
  }
};

// Custom H1 optimization with Gemini
export const customH1Optimization = async (req, res) => {
  try {
    const { siteId } = req.params;
    const { userRequest, currentH1, pageUrl, pageTitle } = req.body;

    if (!userRequest) {
      return res.status(400).json({ error: 'User request is required' });
    }

    // Verify site exists
    const site = await Site.findOne({ siteId });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Create Gemini prompt for custom H1 optimization
    const geminiPrompt = `
You are an expert SEO consultant. A user wants to optimize their H1 heading based on their specific request.

CURRENT PAGE CONTEXT:
- Page URL: ${pageUrl}
- Page Title: ${pageTitle}
- Current H1: "${currentH1}"
- Site: ${site.name} (${site.domain})

USER REQUEST: "${userRequest}"

Based on the user's request, create an SEO-optimized H1 that:
1. Addresses the user's specific requirements
2. Follows SEO best practices (50-60 characters ideal)
3. Includes relevant keywords
4. Is compelling and click-worthy
5. Matches the page content context

Respond with ONLY a JSON object in this exact format:
{
  "optimizedH1": "Your optimized H1 text here",
  "explanation": "Brief explanation of why this H1 is better for SEO and how it addresses the user's request",
  "seoScore": "estimated SEO improvement score 1-10",
  "keywords": ["key", "words", "included"]
}

Make the H1 compelling, SEO-friendly, and exactly what the user requested.`;

    // Call Gemini API
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: geminiPrompt
          }]
        }]
      })
    });

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const responseText = geminiData.candidates[0].content.parts[0].text;
    
    // Parse JSON from Gemini response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse H1 optimization from Gemini response');
    }

    const optimization = JSON.parse(jsonMatch[0]);

    res.json({
      optimizedH1: optimization.optimizedH1,
      explanation: optimization.explanation,
      seoScore: optimization.seoScore,
      keywords: optimization.keywords,
      userRequest,
      originalH1: currentH1
    });

  } catch (error) {
    console.error('Error optimizing H1:', error);
    res.status(500).json({ error: 'Failed to optimize H1' });
  }
};

// Scrape external URL endpoint
export const scrapeUrl = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Scrape the URL
    const scrapedData = await scrapeUrlData(url);

    res.json({
      message: 'URL scraped successfully',
      url: url,
      data: scrapedData,
      scrapedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error scraping URL:', error);
    res.status(500).json({ 
      error: 'Failed to scrape URL',
      details: error.message 
    });
  }
};
