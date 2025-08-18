import mongoose from 'mongoose';

const seoSnapshotSchema = new mongoose.Schema({
  siteId: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  filePath: {
    type: String,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('SeoSnapshot', seoSnapshotSchema);
