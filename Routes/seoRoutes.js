import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  registerSite, 
  collectSeoData, 
  getSitePages, 
  getSeoSuggestions, 
  crawlSitePages,
  prepareDomOptimization,
  customH1Optimization
} from '../Controllers/seoController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Serve the client sniffer script
router.get('/sniffer.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, '../public/sniffer.js'));
});

// Collect SEO data from client
router.post('/collect', collectSeoData);

// Register a new site
router.post('/api/sites', registerSite);

// Get collected SEO data for a site
router.get('/api/sites/:siteId/pages', getSitePages);

// Analyze SEO data and get suggestions from Gemini
router.post('/api/sites/:siteId/analyze', analyzeSeoData);

// Auto-inject script tag into all HTML files in project
router.post('/api/sites/:siteId/auto-inject', autoInjectScript);

// Apply SEO suggestion to HTML file
router.post('/api/sites/:siteId/apply-suggestion', applySuggestion);

// Crawl all HTML files in project and extract SEO data
router.post('/api/sites/:siteId/crawl', crawlSitePages);

// Prepare DOM optimization
router.post('/api/sites/:siteId/prepare-optimization', prepareDomOptimization);

// Custom H1 optimization with Gemini
router.post('/api/sites/:siteId/custom-h1', customH1Optimization);

export default router;
