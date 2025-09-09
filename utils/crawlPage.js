export const crawlPage = async (browser, currentUrl, visitedUrls) => {
  const cleanUrlForCheck = currentUrl.split("#")[0];
  if (visitedUrls.has(cleanUrlForCheck)) {
    return { pageData: null, newLinks: new Set() };
  }

  let page;
  try {
    visitedUrls.add(cleanUrlForCheck);
    console.log(`Crawling: ${currentUrl}`);

    page = await browser.newPage();
    await page.goto(currentUrl, { waitUntil: "networkidle2", timeout: 30000 });

    const extractedData = await page.evaluate((url) => {
      const getMeta = (name) =>
        document.querySelector(`meta[name="${name}"]`)?.content?.trim() || null;

      const headings = Array.from(
        document.querySelectorAll("h1, h2, h3, h4, h5, h6")
      )
        .map((el) => ({
          level: el.tagName.toLowerCase(),
          text: el.innerText.trim(),
          id: el.id || null,
        }))
        .filter((h) => h.text);

      const paragraphs = Array.from(document.querySelectorAll("p"))
        .map((el) => el.innerText.trim())
        .filter(Boolean);

      const links = Array.from(document.querySelectorAll("a"))
        .map((el) => ({
          url: el.href,
          text: el.innerText.trim(),
          title: el.title || null,
        }))
        .filter((l) => l.url);

      const images = Array.from(document.querySelectorAll("img")).map((el) => ({
        src: el.src,
        alt: el.alt?.trim() || null,
        title: el.title?.trim() || null,
      }));

      const lists = Array.from(document.querySelectorAll("ul, ol")).map(
        (list) =>
          Array.from(list.querySelectorAll("li"))
            .map((li) => li.innerText.trim())
            .filter(Boolean)
      );

      const tables = Array.from(document.querySelectorAll("table")).map(
        (table) =>
          Array.from(table.querySelectorAll("tr")).map((row) =>
            Array.from(row.querySelectorAll("th, td"))
              .map((cell) => cell.innerText.trim())
              .filter(Boolean)
          )
      );

      return {
        url,
        title: document.title.trim() || null,
        headings,
        paragraphs,
        links,
        images,
        lists,
        tables,
        textContent: document.body.innerText.trim(),
        rawHTML: document.documentElement.outerHTML,
        keywords: getMeta("keywords")
          ? getMeta("keywords")
              .split(",")
              .map((k) => k.trim())
          : [],
        author: getMeta("author"),
        metaDescription: getMeta("description") || null,
      };
    }, currentUrl);

    const newLinks = new Set(extractedData.links.map((link) => link.url));
    return { pageData: extractedData, newLinks };
  } catch (error) {
    console.error(`Error crawling ${currentUrl}: ${error.message}`);
    return { pageData: null, newLinks: new Set() };
  } finally {
    if (page) await page.close();
  }
}