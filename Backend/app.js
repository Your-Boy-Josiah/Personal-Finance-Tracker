// ===============================================================
//  app.js
//  Main entry point for the Express server.
//  Initializes middleware, loads environment variables,
//  connects to MongoDB, and mounts API routes.
// ===============================================================

const express = require("express");
const path = require('path');
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/database");
const { errorHandler } = require("./middleware/errorMiddleware");
const logger = require('./utils/logger');
const initializeCronJobs = require('./utils/cronJobs');

// ==============================================================
// ENVIRONMENT CONFIGURATION & DATABASE SETUP
// ==============================================================

dotenv.config();

// ==============================================================
// EXPRESS APP INITIALIZATION
// ==============================================================

const app = express();

// This API authenticates with bearer tokens, so it does not need cookie
// credentials. Reflect the request origin so the Vercel app, local frontend,
// and Vercel preview deployments can call the API.
const corsOptions = {
  origin: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  optionsSuccessStatus: 204,
  maxAge: 86400,
};

// cors() answers OPTIONS preflight requests here, before Helmet, rate limiting,
// and route handlers can reject or otherwise alter the response.
app.use(cors(corsOptions));

// ==============================================================
// MIDDLEWARE SETUP & SECURITY
// ==============================================================

// Secure HTTP headers
app.use(helmet()); 

// Global Rate Limiting: Max 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  message: { 
    success: false, 
    message: 'Too many requests from this IP, please try again after 15 minutes.' 
  }
});

app.use(express.json()); // Parses incoming JSON payloads in request bodies
app.use("/api", apiLimiter); // Applies rate limiting to all /api routes
app.use('/api/alerts', require('./routes/alertRoutes'));
// Make uploads directory accessible to the frontend
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'uploads')));

// ==============================================================
// API ROUTES
// ==============================================================

// Base health check route to verify server status
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Personal Finance Tracker API is running successfully",
  });
});

// Mounted API endpoints
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/transactions", require("./routes/transactionRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/bank", require("./routes/bankRoutes"));
app.use("/api/budget", require("./routes/budgetRoutes"));

// ==============================================================
// CUSTOM ERROR HANDLING
// ==============================================================

// Must be mounted AFTER all API routes to catch unhandled errors
app.use(errorHandler);

// ==============================================================
// SERVER LISTENING, DATABASE, & EXPORT
// ==============================================================

const PORT = process.env.PORT || 5000;

// Prevent the real database, cron jobs, and server from starting during Jest tests
if (process.env.NODE_ENV !== 'test') {
  connectDB();            // Start the real database
  initializeCronJobs();  // Start the real cron jobs
  
  app.listen(PORT, () => {
    logger.info(`Server securely running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  });
}

// Export the app for Supertest to use in audit.test.js
module.exports = app;

