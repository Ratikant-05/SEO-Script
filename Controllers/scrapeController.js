import ScrapedData from "../Models/ScrapedData.js";
import CrawlSession from "../Models/CrawlSession.js";
import puppeteer from "puppeteer";
import axios from "axios";
import {crawlPage} from '../utils/crawlPage.js';
import { getOptimizedTextContentFromAI } from "../utils/aiOptimiser.js";

export const crawlSite = async (req, res) => {
  const {
    startUrl,
    maxPages = 10,
    siteId = "default-site",
    userId = "default-user",
  } = req.body;
  if (!startUrl) return res.status(400).json({ error: "startUrl is required" });

  let browser;
  try {
    browser = await puppeteer.launch({ headless: true });
    const baseUrl = new URL(startUrl).origin;
    const visited = new Set();
    const queue = [startUrl];
    const crawledDataForResponse = [];
    const scrapedPageIds = [];
    let pagesCrawled = 0;

    // ✅ Create empty session first
    const session = await CrawlSession.create({
      siteId,
      userId,
      startUrl,
      totalUrlsScraped: 0,
      visitedUrls: [],
    });

    while (queue.length > 0 && pagesCrawled < maxPages) {
      const currentUrl = queue.shift();
      const cleanUrlForCheck = currentUrl.split("#")[0];
      if (visited.has(cleanUrlForCheck)) continue;
      visited.add(cleanUrlForCheck);
      pagesCrawled++;

      try {
        const { pageData, newLinks } = await crawlPage(
          browser,
          currentUrl,
          visited
        );

        if (pageData && pageData.rawHTML) {
          let optimizedHtml = null;

          // ✅ AI Optimization
          try {
            console.log(`Optimizing HTML for: ${pageData.url}`);
            optimizedHtml = await getOptimizedTextContentFromAI(
              pageData.rawHTML
            );
          } catch (optimizationError) {
            console.error(
              `Could not optimize HTML for ${pageData.url}: ${optimizationError.message}`
            );
          }

          optimizedHtml = optimizedHtml || pageData.rawHTML;

          // ✅ Build scraped page doc
          try {
            const dataToSave = {
              siteId,
              userId,
              crawlSessionId: session._id,
              fileId: pageData.fileName,
              fileName: pageData.fileName,
              url: pageData.url,
              optimizedHtml,
              rawHTML: pageData.rawHTML,
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
              textContent: pageData.textContent || [],
              theme: pageData.theme || {},
              keywords: pageData.keywords || [],
              additionalUrls: pageData.additionalUrls || [],
              scrapingMethod: "enhanced",
              metadata: pageData.metadata || {},
            };

            const scrapedPage = await ScrapedData.findOneAndUpdate(
              { fileId: pageData.fileName },
              { $set: dataToSave },
              { upsert: true, new: true }
            );

            scrapedPageIds.push(scrapedPage._id);
            console.log(`Saved data for: ${pageData.url}`);
          } catch (dbError) {
            console.error(
              `Failed to save data for ${pageData.url}: ${dbError.message}`
            );
          }

          crawledDataForResponse.push({ ...pageData, optimizedHtml });
        }

        // ✅ Queue new links
        newLinks.forEach((linkUrl) => {
          try {
            const absoluteUrl = new URL(linkUrl, baseUrl).href;
            const cleanLink = absoluteUrl.split("#")[0];
            if (cleanLink.startsWith(baseUrl) && !visited.has(cleanLink)) {
              if (
                ![...queue].some((qUrl) => qUrl.split("#")[0] === cleanLink)
              ) {
                queue.push(absoluteUrl);
              }
            }
          } catch {
            // ignore invalid URLs
          }
        });
      } catch (err) {
        console.error(`Failed to crawl ${currentUrl}: ${err.message}`);
      }
    }

    // ✅ Update crawl session with summary + scraped page references
    const crawlResponse = {
      message: "Crawling finished.",
      totalUrlsScraped: visited.size,
      visitedUrls: Array.from(visited),
      data: crawledDataForResponse,
    };

    await CrawlSession.findByIdAndUpdate(session._id, {
      $set: {
        totalUrlsScraped: visited.size,
        visitedUrls: Array.from(visited),
        scrapedPageIds, // renamed to match ScrapedData references
      },
    });

    console.log(`Crawl session saved with ID: ${session._id}`);
    res.json({ ...crawlResponse, sessionId: session._id });
  } catch (error) {
    console.error("An error occurred during the crawl operation:", error);
    res.status(500).json({ error: "Crawling failed." });
  } finally {
    if (browser) await browser.close();
  }
};

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

export const getSeoSuggestions = async (req, res) => {
  try {
    const { url, sessionId, siteId, userId } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    // Here you would typically fetch the crawled data from your database
    // For this example, we'll simulate fetching the data
    const pageData = await fetchCrawledData(url, sessionId);

    if (!pageData) {
      return res
        .status(404)
        .json({ error: "No crawled data found for this URL" });
    }

    // Generate SEO suggestions using AI
    const seoSuggestions = await generateSEOSuggestions(pageData);

    // Return the suggestions
    res.json(seoSuggestions);
  } catch (error) {
    console.error("Error generating SEO suggestions:", error);
    res.status(500).json({ error: "Failed to generate SEO suggestions" });
  }
};

async function fetchCrawledData(url, sessionId) {
  try {
    // In a real implementation, you would fetch this from your database
    // For this example, we'll use puppeteer to fetch the current page data
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: "networkidle2" });

    // Extract page data using Puppeteer
    const pageData = await page.evaluate(() => {
      // Helper function to get meta description
      function getMetaDescription() {
        const metaDesc = document.querySelector('meta[name="description"]');
        return metaDesc ? metaDesc.getAttribute("content") : null;
      }

      // Helper function to extract headings
      function extractHeadings() {
        const headings = [];
        const headingElements = document.querySelectorAll(
          "h1, h2, h3, h4, h5, h6"
        );

        headingElements.forEach((el, index) => {
          headings.push({
            selector: getUniqueSelector(el),
            level: el.tagName.toLowerCase(),
            text: el.textContent.trim(),
          });
        });

        return headings;
      }

      // Helper function to extract paragraphs
      function extractParagraphs() {
        const paragraphs = [];
        const paraElements = document.querySelectorAll("p");

        paraElements.forEach((el, index) => {
          // Skip very short paragraphs or those likely to be UI elements
          if (el.textContent.trim().length > 20) {
            paragraphs.push({
              selector: getUniqueSelector(el),
              text: el.textContent.trim(),
            });
          }
        });

        return paragraphs;
      }

      // Helper function to extract images
      function extractImages() {
        const images = [];
        const imgElements = document.querySelectorAll("img");

        imgElements.forEach((el, index) => {
          // Skip tiny images that are likely icons
          if (el.width > 50 && el.height > 50) {
            images.push({
              selector: getUniqueSelector(el),
              src: el.src,
              alt: el.alt || "",
            });
          }
        });

        return images;
      }

      // Generate a unique CSS selector for an element
      function getUniqueSelector(el) {
        // Simple implementation - in a real app you'd want something more robust
        if (el.id) {
          return `#${el.id}`;
        }

        if (el.className) {
          const classes = el.className
            .split(" ")
            .filter((c) => c.trim().length > 0)
            .join(".");

          if (classes) {
            return `.${classes}`;
          }
        }

        // Fallback to tag name and position
        const siblings = Array.from(el.parentNode.children);
        const index = siblings.indexOf(el) + 1;
        return `${el.tagName.toLowerCase()}:nth-child(${index})`;
      }

      return {
        title: document.title || "Sample Page Title",
        metaDescription: getMetaDescription() || "",
        headings: extractHeadings(),
        paragraphs: extractParagraphs(),
        images: extractImages(),
        keywords: ["seo", "optimization", "website", "content"], // Default keywords
      };
    });

    await browser.close();

    return {
      url,
      ...pageData,
      sessionId,
    };
  } catch (error) {
    console.error("Error fetching page data:", error);

    // Return mock data if fetching fails
    return {
      url,
      title: "Sample Page Title",
      metaDescription: "",
      headings: [],
      paragraphs: [],
      images: [],
      keywords: ["seo", "optimization", "website", "content"],
      sessionId,
    };
  }
}

async function generateSEOSuggestions(pageData) {
  try {
    // Prepare the prompt for the AI
    const prompt = `
      You are an SEO expert. Analyze this webpage and provide specific optimization suggestions.
      
      URL: ${pageData.url}
      Title: ${pageData.title}
      Meta Description: ${pageData.metaDescription || "None"}
      
      Headings:
      ${JSON.stringify(pageData.headings, null, 2)}
      
      Paragraphs (sample):
      ${JSON.stringify(pageData.paragraphs.slice(0, 3), null, 2)}
      
      Images:
      ${JSON.stringify(pageData.images, null, 2)}
      
      Keywords: ${pageData.keywords.join(", ")}
      
      Please provide specific suggestions for:
      1. Title tag optimization
      2. Meta description optimization
      3. Heading improvements
      4. Paragraph content enhancements
      5. Image alt text improvements
      
      Format your response as a JSON object with these keys:
      - titleTagAnalysis: { current, suggestion }
      - metaDescriptionAnalysis: { current, suggestion }
      - headingsAnalysis: [{ selector, level, current, suggestion }]
      - paragraphAnalysis: [{ selector, current, suggestion }]
      - imageAnalysis: [{ selector, currentAlt, altSuggestion }]
    `;

    // Call the AI API (OpenRouter in this case)
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are an SEO expert assistant that provides specific, actionable suggestions for webpage optimization.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        },
      }
    );

    // Parse the AI response
    const aiResponse = response.data.choices[0].message.content;
    const suggestions = JSON.parse(aiResponse);

    return suggestions;
  } catch (error) {
    console.error("Error generating AI SEO suggestions:", error);

    // Return basic suggestions if AI fails
    return generateFallbackSuggestions(pageData);
  }
}

function generateFallbackSuggestions(pageData) {
  return {
    titleTagAnalysis: {
      current: pageData.title,
      suggestion: `Optimized: ${pageData.title} | ${
        pageData.keywords[0] || "SEO"
      } Tips`,
    },
    metaDescriptionAnalysis: {
      current: pageData.metaDescription || "None",
      suggestion: `Learn about ${pageData.keywords.join(
        ", "
      )} in this comprehensive guide. Improve your website's SEO and drive more traffic.`,
    },
    headingsAnalysis: pageData.headings.map((heading) => ({
      selector: heading.selector,
      level: heading.level,
      current: heading.text,
      suggestion: `Optimized: ${heading.text} for Better SEO`,
    })),
    paragraphAnalysis: pageData.paragraphs.map((para) => ({
      selector: para.selector,
      current: para.text,
      suggestion: `${
        para.text
      } [Enhanced with keywords: ${pageData.keywords.join(", ")}]`,
    })),
    imageAnalysis: pageData.images.map((img) => ({
      selector: img.selector,
      currentAlt: img.alt || "None",
      altSuggestion: img.alt
        ? `${img.alt} - ${pageData.keywords[0]}`
        : `Image of ${pageData.keywords.join(" and ")}`,
    })),
  };
}

