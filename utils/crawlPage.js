import crypto from "crypto";

export const crawlPage = async (browser, currentUrl) => {
  let page;
  try {
    console.log(`[crawlPage] Navigating to: ${currentUrl}`);

    page = await browser.newPage();
    // Set a longer timeout, 30s can be too short for some sites
    await page.goto(currentUrl, { waitUntil: "networkidle2", timeout: 60000 }); 

    const extractedData = await page.evaluate((url) => {
      const getMeta = (name) =>
        document.querySelector(`meta[name="${name}"]`)?.content?.trim() || null;

      // Helper to extract content and handle potential nulls gracefully
      const extractElements = (selector, mapFn) => 
        Array.from(document.querySelectorAll(selector))
             .map(mapFn)
             .filter(Boolean);

      const headings = extractElements("h1, h2, h3, h4, h5, h6", (el) => ({
          level: el.tagName.toLowerCase(),
          text: el.innerText.trim(),
          id: el.id || null,
          className: el.className || null,
      })).filter((h) => h.text); // Ensure headings have text

      const paragraphs = extractElements("p", (el) => el.innerText.trim());

      const links = extractElements("a", (el) => ({
          url: el.href,
          text: el.innerText.trim(),
          title: el.title || null,
      })).filter((l) => l.url && l.url !== '#'); // Filter out empty or anchor-only links

      const images = extractElements("img", (el) => ({
          src: el.src,
          alt: el.alt?.trim() || null,
          title: el.title?.trim() || null,
      }));

      const lists = extractElements("ul, ol", (list) =>
          extractElements("li", (li) => li.innerText.trim(), list) // Pass list as context
      ).filter(list => list.length > 0); // Only include non-empty lists

      const tables = extractElements("table", (table) =>
          extractElements("tr", (row) =>
              extractElements("th, td", (cell) => cell.innerText.trim(), row) // Pass row as context
                  .filter(Boolean),
          table)
          .filter(row => row.length > 0) // Only include non-empty rows
      ).filter(table => table.length > 0); // Only include non-empty tables


      // Extract content from common semantic elements
      const divs = extractElements('div', (el) => el.outerHTML);
      const spans = extractElements('span', (el) => el.outerHTML);
      const forms = extractElements('form', (el) => ({
        action: el.action,
        method: el.method,
        id: el.id || null,
        className: el.className || null,
        inputs: Array.from(el.querySelectorAll('input, select, textarea')).map(input => ({
          type: input.type,
          name: input.name,
          value: input.value,
          id: input.id,
          placeholder: input.placeholder,
        }))
      }));
      const navigation = extractElements('nav', (el) => el.outerHTML);
      const footer = extractElements('footer', (el) => el.outerHTML);
      const header = extractElements('header', (el) => el.outerHTML);
      const main = extractElements('main', (el) => el.outerHTML);
      const articles = extractElements('article', (el) => el.outerHTML);
      const sections = extractElements('section', (el) => el.outerHTML);

      // Simple theme extraction (can be expanded)
      const theme = {
        extracted: true,
        timestamp: new Date(),
        backgroundColor: window.getComputedStyle(document.body).backgroundColor,
        textColor: window.getComputedStyle(document.body).color,
        fontFamily: window.getComputedStyle(document.body).fontFamily,
      };

      // Additional URLs (e.g., from meta tags, or specific script tags)
      const additionalUrls = [];
      Array.from(document.querySelectorAll('link[rel="canonical"], link[rel="alternate"], a[rel="next"], a[rel="prev"]'))
           .forEach(el => {
               if (el.href) {
                   additionalUrls.push({ url: el.href, source: el.rel || 'meta link' });
               }
           });
      
      return {
        url,
        title: document.title.trim() || null,
        headings,
        paragraphs,
        links,
        images,
        lists,
        tables,
        divs,
        spans,
        forms,
        navigation,
        footer,
        header,
        main,
        articles,
        sections,
        textContent: document.body.innerText.trim(),
        rawHTML: document.documentElement.outerHTML,
        keywords: getMeta("keywords")
          ? getMeta("keywords").split(",").map((k) => k.trim())
          : [],
        author: getMeta("author"),
        metaDescription: getMeta("description") || null,
        theme,
        additionalUrls,
        metadata: {
          fileSize: document.documentElement.outerHTML.length, // Basic size estimation
          version: "2.0.0",
          note: "Scraped via Puppeteer",
          error: false,
        }
      };
    }, currentUrl);

    // Generate fileId and fileName here and include it in the return
    // This makes sure crawlSite gets this unique ID
    const fileId = crypto.createHash("md5").update(currentUrl).digest("hex");
    extractedData.fileId = fileId;
    extractedData.fileName = `${fileId}.html`;

    const newLinks = new Set(extractedData.links.map((link) => link.url));

    return {
      pageData: extractedData,
      newLinks,
    };
  } catch (error) {
    console.error(`[crawlPage] Error crawling ${currentUrl}: ${error.message}`);
    // Log full error stack for debugging
    console.error(`[crawlPage] Stack: ${error.stack}`);
    return null;
  } finally {
    if (page) {
      await page.close();
      console.log(`[crawlPage] Page closed for: ${currentUrl}`);
    }
  }
};
