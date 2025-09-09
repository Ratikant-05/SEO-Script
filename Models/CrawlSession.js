import mongoose from "mongoose";

const CrawlSessionSchema = new mongoose.Schema({
  siteId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  startUrl: { type: String, required: true },

  totalUrlsScraped: { type: Number, default: 0 },
  visitedUrls: [String],
  
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model("CrawlSession", CrawlSessionSchema);
