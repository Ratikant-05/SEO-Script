import express from 'express';
import Site from '../Models/Site.js';
import SeoSnapshot from '../Models/SeoSnapshot.js';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import fs from 'fs/promises';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Serve the client sniffer script
router.get('/sniffer.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, '../public/sniffer.js'));
});

// Collect SEO data from client
router.post('/collect', async (req, res) => {
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
});

// Register a new site
router.post('/api/sites', async (req, res) => {
  try {
    console.log('Received request body:', req.body);
    const { name, domain } = req.body;

    if (!name || !domain) {
      console.log('Missing fields - name:', name, 'domain:', domain);
      return res.status(400).json({ error: 'Name and domain are required' });
    }

    // Domain validation - allow localhost, IP addresses, URLs with ports, and standard domains
    const domainRegex = /^(localhost(:\d+)?|127\.0\.0\.1(:\d+)?|(\d{1,3}\.){3}\d{1,3}(:\d+)?|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|https?:\/\/.+)$/;
    if (!domainRegex.test(domain)) {
      console.log('Domain validation failed for:', domain);
      return res.status(400).json({ error: 'Invalid domain format. Use: example.com, localhost, or IP address' });
    }

    // Check if domain is already registered
    const existingSite = await Site.findOne({ domain });
    if (existingSite) {
      const installSnippet = `<script defer src="http://localhost:4444/sniffer.js" data-site-id="${existingSite.siteId}"></script>`;
      
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

    const installSnippet = `<script defer src="http://localhost:4444/sniffer.js" data-site-id="${siteId}"></script>`;

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
});

// Get collected SEO data for a site
router.get('/api/sites/:siteId/pages', async (req, res) => {
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
});

// Analyze SEO data and get suggestions from Gemini
router.post('/api/sites/:siteId/analyze', async (req, res) => {
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
Analyze this SEO data and provide specific, actionable suggestions to improve SEO:

Page URL: ${latestSnapshot.url}
Site: ${site.name} (${site.domain})

HEADINGS:
${seoData.headings.map(h => `${h.tag.toUpperCase()}: ${h.text}`).join('\n')}

META DESCRIPTION: ${seoData.metaDescription || 'MISSING'}

META TAGS:
${seoData.metaTags.map(m => `${m.name || m.property}: ${m.content}`).join('\n')}

IMAGES: ${seoData.images.length} images found
${seoData.images.slice(0, 5).map(img => `- ${img.alt || 'NO ALT TEXT'} (${img.src})`).join('\n')}

LINKS: ${seoData.anchors.length} links found

Please provide suggestions in this exact JSON format:
{
  "suggestions": [
    {
      "type": "title",
      "priority": "high|medium|low",
      "issue": "Brief description of the issue",
      "suggestion": "Specific suggestion text",
      "currentValue": "current title text",
      "suggestedValue": "improved title text",
      "element": "title"
    },
    {
      "type": "meta_description", 
      "priority": "high|medium|low",
      "issue": "Brief description",
      "suggestion": "Specific suggestion",
      "currentValue": "current meta description",
      "suggestedValue": "improved meta description",
      "element": "meta[name='description']"
    },
    {
      "type": "heading",
      "priority": "high|medium|low", 
      "issue": "Brief description",
      "suggestion": "Specific suggestion",
      "currentValue": "current heading text",
      "suggestedValue": "improved heading text",
      "element": "h1|h2|h3|h4|h5|h6",
      "selector": "specific CSS selector if needed"
    },
    {
      "type": "alt_text",
      "priority": "high|medium|low",
      "issue": "Brief description", 
      "suggestion": "Specific suggestion",
      "currentValue": "current alt text or empty",
      "suggestedValue": "improved alt text",
      "element": "img",
      "selector": "img[src='specific-image-url']"
    }
  ]
}

Focus on the most impactful SEO improvements. Limit to 8 suggestions maximum.`;

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
      suggestions: suggestions.suggestions
    });

  } catch (error) {
    console.error('Error analyzing SEO data:', error);
    res.status(500).json({ error: 'Failed to analyze SEO data' });
  }
});

// Apply SEO suggestion to actual file
router.post('/api/sites/:siteId/apply-suggestion', async (req, res) => {
  try {
    const { siteId } = req.params;
    const { suggestion, filePath } = req.body;

    if (!suggestion || !filePath) {
      return res.status(400).json({ error: 'Suggestion and file path are required' });
    }

    // Verify site exists
    const site = await Site.findOne({ siteId });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Read the HTML file
    const fullPath = path.resolve(filePath);
    let htmlContent = await fs.readFile(fullPath, 'utf-8');

    // Apply suggestion based on type
    switch (suggestion.type) {
      case 'title':
        htmlContent = htmlContent.replace(
          /<title>([^<]*)<\/title>/i,
          `<title>${suggestion.suggestedValue}</title>`
        );
        break;

      case 'meta_description':
        if (suggestion.currentValue) {
          // Update existing meta description
          htmlContent = htmlContent.replace(
            /<meta\s+name=["']description["']\s+content=["'][^"']*["'][^>]*>/i,
            `<meta name="description" content="${suggestion.suggestedValue}">`
          );
        } else {
          // Add new meta description
          htmlContent = htmlContent.replace(
            /(<head[^>]*>)/i,
            `$1\n    <meta name="description" content="${suggestion.suggestedValue}">`
          );
        }
        break;

      case 'heading':
        if (suggestion.selector) {
          // Use specific selector if provided
          const regex = new RegExp(`(<${suggestion.element}[^>]*>)([^<]*)(</h[1-6]>)`, 'i');
          htmlContent = htmlContent.replace(regex, `$1${suggestion.suggestedValue}$3`);
        } else {
          // Replace first occurrence of the heading type
          const regex = new RegExp(`(<${suggestion.element}[^>]*>)([^<]*)(</h[1-6]>)`, 'i');
          htmlContent = htmlContent.replace(regex, `$1${suggestion.suggestedValue}$3`);
        }
        break;

      case 'alt_text':
        if (suggestion.selector) {
          // Update specific image
          const imgSrc = suggestion.selector.match(/img\[src=['"]([^'"]*)['"]\]/)?.[1];
          if (imgSrc) {
            const regex = new RegExp(`(<img[^>]*src=["']${imgSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*?)(?:alt=["'][^"']*["'])?([^>]*>)`, 'i');
            htmlContent = htmlContent.replace(regex, `$1alt="${suggestion.suggestedValue}"$2`);
          }
        }
        break;

      default:
        return res.status(400).json({ error: 'Unsupported suggestion type' });
    }

    // Write the updated content back to file
    await fs.writeFile(fullPath, htmlContent, 'utf-8');

    res.json({
      message: 'Suggestion applied successfully',
      type: suggestion.type,
      appliedValue: suggestion.suggestedValue
    });

  } catch (error) {
    console.error('Error applying suggestion:', error);
    res.status(500).json({ error: 'Failed to apply suggestion' });
  }
});

// Auto-inject script tag into all HTML files in project
router.post('/api/sites/:siteId/auto-inject', async (req, res) => {
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
      `https://your-seo-backend.herokuapp.com/sniffer.js` : 
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
});

// Apply AI suggestion to HTML file
router.post('/api/sites/:siteId/apply-suggestion', async (req, res) => {
  try {
    const { siteId } = req.params;
    const { filePath, suggestionType, newContent, targetElement } = req.body;

    if (!filePath || !suggestionType || !newContent) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify site exists
    const site = await Site.findOne({ siteId });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Read the HTML file
    let content = await fs.readFile(filePath, 'utf-8');
    let modified = false;

    switch (suggestionType) {
      case 'meta_description':
        // Update or add meta description
        const metaDescRegex = /<meta\s+name=["']description["'][^>]*>/i;
        const newMetaDesc = `<meta name="description" content="${newContent}">`;
        
        if (metaDescRegex.test(content)) {
          content = content.replace(metaDescRegex, newMetaDesc);
        } else {
          // Add after charset meta or in head
          const headMatch = content.match(/(<head[^>]*>)/i);
          if (headMatch) {
            const insertPos = headMatch.index + headMatch[0].length;
            content = content.slice(0, insertPos) + `\n    ${newMetaDesc}` + content.slice(insertPos);
          }
        }
        modified = true;
        break;

      case 'title':
        // Update title tag
        const titleRegex = /<title[^>]*>.*?<\/title>/i;
        const newTitle = `<title>${newContent}</title>`;
        
        if (titleRegex.test(content)) {
          content = content.replace(titleRegex, newTitle);
          modified = true;
        }
        break;

      case 'heading':
        // Update specific heading
        if (targetElement) {
          const headingRegex = new RegExp(`(<${targetElement}[^>]*>).*?(<\/${targetElement}>)`, 'i');
          if (headingRegex.test(content)) {
            content = content.replace(headingRegex, `$1${newContent}$2`);
            modified = true;
          }
        }
        break;

      case 'alt_text':
        // Update image alt text
        if (targetElement) {
          const imgRegex = new RegExp(`(<img[^>]*src=["']${targetElement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*?)alt=["'][^"']*["']([^>]*>)`, 'i');
          if (imgRegex.test(content)) {
            content = content.replace(imgRegex, `$1alt="${newContent}"$2`);
            modified = true;
          } else {
            // Add alt attribute if it doesn't exist
            const imgRegex2 = new RegExp(`(<img[^>]*src=["']${targetElement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*?)(/?>)`, 'i');
            if (imgRegex2.test(content)) {
              content = content.replace(imgRegex2, `$1 alt="${newContent}"$2`);
              modified = true;
            }
          }
        }
        break;

      default:
        return res.status(400).json({ error: 'Unsupported suggestion type' });
    }

    if (modified) {
      // Write the updated content back to file
      await fs.writeFile(filePath, content, 'utf-8');
      
      res.json({
        success: true,
        message: 'Suggestion applied successfully',
        suggestionType,
        filePath: path.relative(process.cwd(), filePath)
      });
    } else {
      res.status(400).json({ error: 'Could not apply suggestion - target element not found' });
    }

  } catch (error) {
    console.error('Error applying suggestion:', error);
    res.status(500).json({ error: 'Failed to apply suggestion' });
  }
});

// Server-side SEO data extraction function
function extractSeoDataFromHtml(htmlContent, filePath, baseUrl = '') {
  const dom = new JSDOM(htmlContent);
  const document = dom.window.document;
  
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

// Crawl all HTML files in project and extract SEO data
router.post('/api/sites/:siteId/crawl', async (req, res) => {
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
        hasMetaDescription: !!r.data?.metaDescription
      }))
    });

  } catch (error) {
    console.error('Error during project crawl:', error);
    res.status(500).json({ error: 'Failed to crawl project' });
  }
});

export default router;
