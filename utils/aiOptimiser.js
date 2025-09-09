export const getOptimizedTextContentFromAI = async (rawHTML) => {
  const userPrompt = `
You are an expert SEO specialist and senior content optimizer. 
Your task: extract text from raw HTML and optimize it for on-page SEO.

1. Extract ONLY from:
   - <title>
   - <meta name="description">
   - <h1>, <h2>, <h3>
   - <img alt="">
   - <p>
   - <a> (only internal links: starts with "/" or current domain)

2. Apply SEO rules:
   - Titles: 50–60 chars, keyword near start.
   - Meta description: <160 chars, engaging, with call-to-action.
   - Headings: concise, keyword-rich, accurate.
   - Image alt: descriptive, keyword-rich.
   - Paragraphs: improve readability, natural keyword use.
   - Anchor text: descriptive, keyword-rich.

3. Output:
Return ONLY a valid JSON object with keys:
{
  "title": [],
  "meta_description": [],
  "h1": [],
  "h2": [],
  "h3": [],
  "img_alt": [],
  "p": [],
  "a_anchor_text": []
}

Each array contains objects:
{
  "original": "...",
  "optimized": "..."
}

If none exist, return empty array for that key.
---

HTML to process:
${rawHTML}
`;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey)
    throw new Error("OPENROUTER_API_KEY is not configured on the server.");

  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "gpt-4o-mini", // better for structured JSON
      messages: [{ role: "user", content: userPrompt }],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  const optimizedContentJson = response.data?.choices?.[0]?.message?.content;

  try {
    const parsedContent = JSON.parse(optimizedContentJson);

    // Validate structure
    const expectedKeys = [
      "title",
      "meta_description",
      "h1",
      "h2",
      "h3",
      "img_alt",
      "p",
      "a_anchor_text",
    ];
    for (const key of expectedKeys) {
      if (!parsedContent.hasOwnProperty(key)) {
        parsedContent[key] = [];
      }
    }

    return parsedContent;
  } catch (e) {
    console.error(
      "Error parsing JSON response from AI:",
      e,
      "Raw response:",
      optimizedContentJson
    );
    throw new Error("Could not parse valid JSON from AI's response.");
  }
}