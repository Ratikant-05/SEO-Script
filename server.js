import express from "express";
import dotenv from "dotenv";
import cors from "cors";

// routes 
import authRoutes from './Routes/authRoutes.js';
import scrapeRoutes from "./Routes/scrapeRoutes.js";
// import seoSuggestionsRoute from './routes/seo-suggestions.js';

import connectDB from "./config/dbConfig.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4444;

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const allowedOrigins = [
      'http://localhost:3000', 'http://127.0.0.1:3000',
      'http://localhost:5500', 'http://127.0.0.1:5500',
      'http://localhost:8080', 'http://127.0.0.1:8080'
    ];
    if (allowedOrigins.includes(origin) || origin.startsWith('http://') || origin.startsWith('https://')) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
// Increase the payload size limit to handle larger HTML content
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use(express.static('public'));

// Routes
app.use('/auth', authRoutes);
app.use('/api', scrapeRoutes);
// app.use('/', seoSuggestionsRoute);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    connectDB();
});