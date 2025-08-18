import mongoose from 'mongoose';

const siteSchema = new mongoose.Schema({
  siteId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  domain: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Site', siteSchema);
