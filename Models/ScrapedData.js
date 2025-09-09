import mongoose from "mongoose";

// ScrapedData Schema (per-page crawl data)
const ScrapedDataSchema = new mongoose.Schema({
  fileId: { type: String, required: true, index: true },  // unique per page
  fileName: { type: String, required: true },
  url: { type: String, required: true, trim: true },

  // Associations
  userId: { type: String, required: true, index: true },
  siteId: { type: String, required: true, index: true },
  crawlSessionId: { type: mongoose.Schema.Types.ObjectId, ref: "CrawlSession", index: true },

  // Content Extraction
  headings: [{
    level: { type: String, enum: ["h1", "h2", "h3", "h4", "h5", "h6"] },
    text: { type: String, required: true },
    id: String,
    className: String
  }],
  paragraphs: [{ type: String }],
  links: [{
    url: { type: String, required: true },
    text: { type: String, required: true }
  }],
  lists: [mongoose.Schema.Types.Mixed],
  tables: [mongoose.Schema.Types.Mixed],
  images: [{ alt: String, src: String }],
  divs: [{ type: String }],
  spans: [{ type: String }],
  forms: [mongoose.Schema.Types.Mixed],
  navigation: [mongoose.Schema.Types.Mixed],
  footer: [mongoose.Schema.Types.Mixed],
  header: [mongoose.Schema.Types.Mixed],
  main: [mongoose.Schema.Types.Mixed],
  articles: [mongoose.Schema.Types.Mixed],
  sections: [mongoose.Schema.Types.Mixed],

  // Raw & Optimized HTML
  textContent: [{ type: String }],
  rawHTML: { type: mongoose.Schema.Types.Mixed },
  optimizedHtml: { type: String },

  // Page Analysis
  keywords: [{ type: String }],
  theme: {
    colors: {
      primary: String,
      secondary: String,
      accent: String,
      background: String,
      text: String,
      border: String,
      button: String,
      link: String
    },
    typography: {
      primaryFont: String,
      secondaryFont: String,
      headingFont: String,
      bodyFont: String,
      fontSize: String,
      fontWeight: String
    },
    layout: {
      borderRadius: String,
      spacing: mongoose.Schema.Types.Mixed,
      shadows: String
    },
    branding: {
      logoUrl: String,
      faviconUrl: String,
      brandName: String
    },
    extracted: { type: Boolean, default: false },
    timestamp: Date
  },

  // Discovery & Crawl Metadata
  additionalUrls: [{
    url: { type: String, required: true },
    source: { type: String, enum: ["sitemap.xml", "robots.txt", "internal links"], required: true },
    timestamp: { type: Date, default: Date.now }
  }],
  scrapingMethod: { type: String, enum: ["enhanced"], default: "enhanced" },

  // File Metadata
  filePath: { type: String, default: null },
  metadata: {
    fileSize: { type: Number, default: 0 },
    version: { type: String, default: "2.0.0" },
    note: { type: String, default: "" },
    error: { type: Boolean, default: false }
  },

  // Audit Fields
  savedAt: { type: Date, default: Date.now },
  scrapedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

const ScrapedData = mongoose.model("ScrapedData", ScrapedDataSchema);
export default ScrapedData;