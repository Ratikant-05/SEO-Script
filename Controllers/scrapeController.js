import ScrapedData from "../Models/ScrapedData.js";
import CrawlSession from "../Models/CrawlSession.js";
import puppeteer from "puppeteer";
import {crawlPage} from '../utils/crawlPage.js';
import { getOptimizedTextContentFromAI } from "../utils/aiOptimiser.js";

// crawling website
export const crawlSite = async (req, res) => {
  const {
    startUrl,
    maxPages = 10,
    siteId = "default-site",
    userId = "default-user",
  } = req.body;
  
  if (!startUrl) {
    return res.status(400).json({ error: "startUrl is required" });
  }

  if (typeof crawlPage !== 'function') {
    console.error('❌ crawlPage function is not defined or not a function');
    return res.status(500).json({ error: "crawlPage function not available" });
  }

  let browser;
  let session; // Declare session here to be accessible in finally block for update
  try {
    console.log('🚀 Starting crawl process...');
    console.log('StartUrl:', startUrl);
    console.log('MaxPages:', maxPages);
    
    // It's often safer to use a non-headless mode for debugging in development,
    // but keep headless: true for production/deployment.
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    console.log('✅ Browser launched successfully');
    
    const baseUrl = new URL(startUrl).origin;
    const visited = new Set();
    const queue = [startUrl];
    const crawledDataForResponse = [];
    const scrapedPageIds = [];
    let pagesCrawled = 0;

    // Create crawl session
    console.log('📝 Creating crawl session...');
    session = await CrawlSession.create({ // Assign to the 'session' variable declared outside try
      siteId,
      userId,
      startUrl,
      totalUrlsScraped: 0,
      visitedUrls: [],
      status: 'in_progress'
    });
    console.log('✅ Crawl session created:', session._id);

    while (queue.length > 0 && pagesCrawled < maxPages) {
      const currentUrl = queue.shift();
      const cleanUrlForCheck = currentUrl.split("#")[0];
      
      if (visited.has(cleanUrlForCheck)) {
        console.log('⏭️  Skipping already visited URL:', cleanUrlForCheck);
        continue;
      }
      visited.add(cleanUrlForCheck);
      pagesCrawled++;

      console.log(`\n🔍 Processing page ${pagesCrawled}/${maxPages}: ${currentUrl}`);
      console.log('Queue remaining:', queue.length);

      try {
        console.log('📡 Calling crawlPage function...');
        
        const crawlResult = await crawlPage(browser, currentUrl);
        
        console.log('📋 CrawlPage result received:');
        console.log('- Result exists:', crawlResult ? '✅ YES' : '❌ NO');
        
        if (!crawlResult || !crawlResult.pageData) { // Added check for pageData presence
          console.log('❌ crawlPage returned null or no pageData, skipping this URL.');
          await CrawlSession.findByIdAndUpdate(session._id, { 
            $addToSet: { failedUrls: currentUrl } 
          });
          continue;
        }

        const { pageData, newLinks = new Set() } = crawlResult;
        
        if (!pageData || !pageData.url) {
          console.log('❌ Invalid pageData received from crawlPage (missing url), skipping save...');
          await CrawlSession.findByIdAndUpdate(session._id, { 
            $addToSet: { failedUrls: currentUrl } 
          });
          continue;
        }

        console.log('📄 PageData analysis:');
        console.log('- URL:', pageData.url);
        console.log('- Has rawHTML:', pageData.rawHTML ? '✅ YES' : '❌ NO');
        console.log('- Has fileId:', pageData.fileId ? '✅ YES' : '❌ NO');
        
        if (pageData.rawHTML) {
          console.log('✅ PageData has rawHTML, proceeding with save...');
          let optimizedHtml = null;

          // AI Optimization
          try {
            console.log(`🤖 Optimizing HTML for: ${pageData.url}`);
            optimizedHtml = await getOptimizedTextContentFromAI(pageData.rawHTML);
            console.log('✅ HTML optimization completed');
          } catch (optimizationError) {
            console.error(
              `❌ Could not optimize HTML for ${pageData.url}: ${optimizationError.message}`
            );
            // Fallback to rawHTML if optimization fails
            optimizedHtml = pageData.rawHTML; 
          }

          const dataToSave = {
            fileId: pageData.fileId,
            fileName: pageData.fileName,
            url: pageData.url,
            
            userId,
            siteId,
            crawlSessionId: session._id,
            
            headings: pageData.headings || [],
            paragraphs: pageData.paragraphs || [],
            links: pageData.links || [],
            lists: pageData.lists || [],
            tables: pageData.tables || [],
            images: pageData.images || [],
            divs: pageData.divs || [],
            spans: pageData.spans || [],
            forms: pageData.forms || [],
            navigation: pageData.navigation || [],
            footer: pageData.footer || [],
            header: pageData.header || [],
            main: pageData.main || [],
            articles: pageData.articles || [],
            sections: pageData.sections || [],
            
            textContent: [pageData.textContent],
            rawHTML: pageData.rawHTML,
            optimizedHtml,
            
            keywords: pageData.keywords || [],
            author: pageData.author || null,
            metaDescription: pageData.metaDescription || null,
            theme: {
              // Ensure timestamp is a Date object, even if it comes as a string or a partial object
              extracted: pageData.theme?.extracted || false,
              backgroundColor: pageData.theme?.backgroundColor || null,
              textColor: pageData.theme?.textColor || null,
              fontFamily: pageData.theme?.fontFamily || null,
            },
            
            additionalUrls: (pageData.additionalUrls || []).map(urlObj => ({
              url: urlObj.url,
              source: urlObj.source || 'internal links',
              timestamp: urlObj.timestamp ? new Date(urlObj.timestamp) : new Date() // FIX HERE
            })),
            scrapingMethod: "enhanced",
            
            filePath: pageData.filePath || null,
            metadata: {
              fileSize: pageData.metadata?.fileSize || pageData.rawHTML.length,
              version: pageData.metadata?.version || "2.0.0",
              note: pageData.metadata?.note || "",
              error: pageData.metadata?.error || false
            },
            
            savedAt: new Date(),
            scrapedAt: new Date()
          };

          console.log('💽 Attempting to save to database...');
          try {
            const scrapedPage = await ScrapedData.findOneAndUpdate(
              { fileId: dataToSave.fileId, crawlSessionId: session._id },
              { $set: dataToSave },
              { upsert: true, new: true }
            );
            
            console.log("✅ Successfully saved ScrapedData with fileId:", dataToSave.fileId);
            console.log("✅ ScrapedPage ID:", scrapedPage._id);
            scrapedPageIds.push(scrapedPage._id);
            
            crawledDataForResponse.push({ 
              ...pageData, 
              optimizedHtml,
              scrapedPageId: scrapedPage._id
            });

            await CrawlSession.findByIdAndUpdate(session._id, {
                $inc: { totalUrlsScraped: 1 },
                $addToSet: { visitedUrls: pageData.url, scrapedPageIds: scrapedPage._id },
            });
            console.log(`✅ Crawl session updated for URL: ${pageData.url}`);

          } catch (dbError) {
            console.error(
              `❌ Failed to save data for ${pageData.url} (fileId: ${dataToSave.fileId}): ${dbError.message}`
            );
            console.error('❌ Full database error:', dbError);
            await CrawlSession.findByIdAndUpdate(session._id, { 
              $addToSet: { failedUrls: pageData.url } 
            });
          }
        } else {
          console.log('❌ No rawHTML found in pageData, skipping save...');
          await CrawlSession.findByIdAndUpdate(session._id, { 
            $addToSet: { failedUrls: currentUrl } 
          });
        }

        console.log(`🔗 Processing ${newLinks.size} new links...`);
        newLinks.forEach((linkUrl) => {
          try {
            const absoluteUrl = new URL(linkUrl, baseUrl).href;
            const cleanLink = absoluteUrl.split("#")[0];

            if (cleanLink.startsWith(baseUrl) && 
                !visited.has(cleanLink) && 
                ![...queue].some((qUrl) => qUrl.split("#")[0] === cleanLink)
            ) {
              queue.push(absoluteUrl);
              console.log('➕ Added to queue:', cleanLink);
            }
          } catch (linkError) {
            console.log('❌ Invalid URL ignored:', linkUrl, linkError.message);
          }
        });
        
      } catch (err) {
        console.error(`❌ ERROR in main crawl loop for ${currentUrl}:`, err.message);
        console.error('❌ Full error:', err);
        console.error('❌ Stack trace:', err.stack);
        await CrawlSession.findByIdAndUpdate(session._id, { 
          $addToSet: { failedUrls: currentUrl } 
        });
      }
      
      console.log(`--- Finished processing ${currentUrl} ---\n`);
    }

    const finalVisitedUrls = Array.from(visited);
    const finalScrapedPageIds = Array.from(new Set(scrapedPageIds));

    const crawlResponse = {
      message: "Crawling finished.",
      totalUrlsAttempted: pagesCrawled,
      totalUrlsScraped: finalScrapedPageIds.length,
      visitedUrls: finalVisitedUrls.length,
      crawledPages: crawledDataForResponse.length,
    };

    console.log('📊 Final results:');
    console.log('- Total URLs attempted:', pagesCrawled);
    console.log('- Total URLs scraped successfully:', finalScrapedPageIds.length);
    console.log('- Visited URLs (including those that failed to save):', finalVisitedUrls.length);

    if (session && session._id) { // Ensure session exists before updating
      await CrawlSession.findByIdAndUpdate(session._id, {
        $set: {
          totalUrlsScraped: finalScrapedPageIds.length,
          visitedUrls: finalVisitedUrls,
          scrapedPageIds: finalScrapedPageIds,
          status: 'completed',
          completedAt: new Date(),
        },
      });
      console.log(`✅ Crawl session updated with ID: ${session._id}`);
    }

    res.json({ 
      ...crawlResponse, 
      sessionId: session?._id, // Use optional chaining
      scrapedPageIds: finalScrapedPageIds.length
    });
    
  } catch (error) {
    console.error("❌ CRITICAL ERROR during crawl operation:", error);
    console.error("❌ Error details:", error.message);
    console.error("❌ Stack trace:", error.stack);
    
    if (session && session._id) {
      await CrawlSession.findByIdAndUpdate(session._id, {
        $set: { status: 'failed', errorMessage: error.message, completedAt: new Date() }
      });
    }

    res.status(500).json({ error: "Crawling failed.", details: error.message });
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }
};

// displaying the data crawled in the UI
export const fetchCrawledData = async (req, res) => {
  const { crawlSessionId, userId } = req.body;

  if (!crawlSessionId) {
    return res.status(400).json({ error: "Invalid Crawl Session ID" });
  }

  try {
    // Find all scraped data associated with the crawl session
    const scrapedData = await ScrapedData.find({ 
      crawlSessionId,
      ...(userId && { userId }) // Only include userId in query if provided
    }).select({
      // Select specific fields to return
      url: 1,
      headings: 1,
      paragraphs: 1,
      links: 1,
      images: 1,
      keywords: 1,
      theme: 1,
      metadata: 1,
      scrapedAt: 1,
      additionalUrls: 1
    }).sort({ scrapedAt: -1 }); // Sort by most recent first

    if (!scrapedData || scrapedData.length === 0) {
      return res.status(404).json({ 
        error: "No scraped data found for this crawl session" 
      });
    }

    // Return the scraped data
    return res.status(200).json({
      success: true,
      count: scrapedData.length,
      data: scrapedData
    });

  } catch (error) {
    console.error("Error fetching scraped data:", error);
    return res.status(500).json({ 
      error: "Internal server error while fetching scraped data" 
    });
  }
}

export const applySEOChanges = async (req, res) => {
  const { url, changes } = req.body;

  if (!url || !changes) {
    return res.status(400).json({ error: "url and changes are required" });
  }

  let browser;
  try {
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2" });

    // This function runs in the browser context to modify the live DOM
    await page.evaluate((changesToApply) => {
      // 1. Apply Title Change
      if (changesToApply.titleTagAnalysis?.suggestion) {
        document.title = changesToApply.titleTagAnalysis.suggestion;
      }

      // 2. Apply Meta Description Change
      if (changesToApply.metaDescriptionAnalysis?.suggestion) {
        let metaDescription = document.querySelector(
          'meta[name="description"]'
        );
        if (metaDescription) {
          metaDescription.setAttribute(
            "content",
            changesToApply.metaDescriptionAnalysis.suggestion
          );
        } else {
          // Create meta description if it doesn't exist
          metaDescription = document.createElement("meta");
          metaDescription.setAttribute("name", "description");
          metaDescription.setAttribute(
            "content",
            changesToApply.metaDescriptionAnalysis.suggestion
          );
          document.head.appendChild(metaDescription);
        }
      }

      // 3. Apply Heading Changes
      if (changesToApply.headingsAnalysis) {
        // Handle specific heading changes if provided as an array
        if (Array.isArray(changesToApply.headingsAnalysis)) {
          changesToApply.headingsAnalysis.forEach((heading) => {
            if (heading.selector && heading.suggestion) {
              const headingElement = document.querySelector(heading.selector);
              if (headingElement) {
                headingElement.innerText = heading.suggestion;
              }
            }
          });
        }
        // Handle single heading change (backward compatibility)
        else if (changesToApply.headingsAnalysis.suggestion) {
          const firstH1 = document.querySelector("h1");
          if (firstH1) {
            firstH1.innerText = changesToApply.headingsAnalysis.suggestion;
          }
        }
      }

      // 4. Apply Paragraph Changes
      if (changesToApply.paragraphAnalysis) {
        if (Array.isArray(changesToApply.paragraphAnalysis)) {
          changesToApply.paragraphAnalysis.forEach((para) => {
            if (para.selector && para.suggestion) {
              const paraElement = document.querySelector(para.selector);
              if (paraElement) {
                paraElement.innerText = para.suggestion;
              }
            }
          });
        }
      }

      // 5. Apply Image Alt Text Changes
      if (changesToApply.imageAnalysis) {
        if (Array.isArray(changesToApply.imageAnalysis)) {
          changesToApply.imageAnalysis.forEach((img) => {
            if (img.selector && img.altSuggestion) {
              const imgElement = document.querySelector(img.selector);
              if (imgElement) {
                imgElement.setAttribute("alt", img.altSuggestion);
              }
            }
          });
        }
      }
    }, changes);

    // Extract the full HTML of the modified page
    const modifiedHtml = await page.content();

    res.json({
      message: "Changes applied for preview.",
      modifiedHtml: modifiedHtml,
    });
  } catch (error) {
    console.error("Error applying changes:", error);
    res.status(500).json({ error: "Failed to apply changes" });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

// for single seo change
export const getSeoSuggestions = async (req, res) => {
  try {
    const { crawlSessionId, userId } = req.body;

    if (!crawlSessionId) {
      return res.status(400).json({ error: "Crawl Session ID is required" });
    }

    // Fetch the crawled data using our updated fetchCrawledData function
    const crawledData = await ScrapedData.find({ 
      crawlSessionId,
      ...(userId && { userId })
    }).select({
      url: 1,
      headings: 1,
      paragraphs: 1,
      links: 1,
      images: 1,
      keywords: 1,
      theme: 1,
      metadata: 1
    });

    if (!crawledData || crawledData.length === 0) {
      return res.status(404).json({ 
        error: "No crawled data found for this session" 
      });
    }

    // Process each page with AI optimization
    const optimizationPromises = crawledData.map(async (pageData) => {
      try {
        const optimizedContent = await getOptimizedTextContentFromAI(pageData);
        return {
          url: pageData.url,
          originalData: {
            headings: pageData.headings,
            keywords: pageData.keywords,
            metadata: pageData.metadata
          },
          optimization: optimizedContent
        };
      } catch (error) {
        console.error(`Error optimizing ${pageData.url}:`, error);
        return {
          url: pageData.url,
          error: "Failed to optimize this page",
          originalData: pageData
        };
      }
    });

    // Wait for all optimizations to complete
    const results = await Promise.all(optimizationPromises);

    // Calculate overall statistics
    const overallStats = results.reduce((stats, result) => {
      if (result.optimization?.seoAnalysis?.score) {
        stats.totalScore += result.optimization.seoAnalysis.score;
        stats.analyzedPages++;
      }
      return stats;
    }, { totalScore: 0, analyzedPages: 0 });

    // Return the complete analysis
    return res.status(200).json({
      success: true,
      summary: {
        totalPages: results.length,
        averageSeoScore: overallStats.analyzedPages > 0 
          ? Math.round(overallStats.totalScore / overallStats.analyzedPages) 
          : 0,
        analyzedPages: overallStats.analyzedPages
      },
      results: results,
      metadata: {
        analyzedAt: new Date().toISOString(),
        crawlSessionId
      }
    });

  } catch (error) {
    console.error("Error generating SEO suggestions:", error);
    return res.status(500).json({ 
      error: "Failed to generate SEO suggestions",
      details: error.message 
    });
  }
};