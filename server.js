import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import rateLimit from "express-rate-limit";
import connectDB from "./config/dbConfig.js";
import seoRoutes from "./Routes/seoRoutes.js";

dotenv.config();

const app = express();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost and development domains
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000', 
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://localhost:8080',
      'http://127.0.0.1:8080'
    ];
    
    // Allow any HTTPS domain for production websites
    if (origin.startsWith('https://')) {
      return callback(null, true);
    }
    
    // Allow any HTTP domain for testing (remove in production)
    if (origin.startsWith('http://')) {
      return callback(null, true);
    }
    
    // Allow specific localhost origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    callback(null, true); // Allow all for now - restrict in production
  },
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/', seoRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 4444;

app.listen(PORT, () => {
    console.log(`SEO Sniffer Server is running on port ${PORT}`);
    connectDB();
});