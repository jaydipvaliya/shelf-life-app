require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { validateEnv } = require('./src/config/env');
const { connectDB } = require('./src/config/db');
const errorHandler = require('./src/middleware/error.middleware');
const { initExpiryJob, runExpiryCheck } = require('./src/jobs/expiryCheck.job');
const verifyJWT = require('./src/middleware/auth.middleware');
const ApiResponse = require('./src/utils/apiResponse');
const ApiError = require('./src/utils/apiError');

// Validate required environment variables in production
validateEnv();

// Import routes
const authRoutes = require('./src/routes/auth.routes');
const itemRoutes = require('./src/routes/item.routes');
const householdRoutes = require('./src/routes/household.routes');
const uploadRoutes = require('./src/routes/upload.routes');
const analyticsRoutes = require('./src/routes/analytics.routes');
const recipeRoutes = require('./src/routes/recipe.routes');
const restockRoutes = require('./src/routes/restock.routes');

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// Trust reverse proxy headers (Render, Railway, Nginx, etc.)
app.set('trust proxy', 1);

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Enable CORS (restrict browser origins via CORS_ORIGIN in production; native clients send no Origin)
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      if (!isProduction && allowedOrigins.length === 0) {
        return callback(null, true);
      }
      return callback(new ApiError(403, 'Origin not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, statusCode: 429, message: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, statusCode: 429, message: 'Too many authentication attempts, please try again later.' },
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 35,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, statusCode: 429, message: 'Too many AI scan requests, please wait a few minutes.' },
});

app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/refresh-token', authLimiter);
app.use('/api/auth/change-password', authLimiter);
app.use('/api/items/scan-receipt', aiLimiter);
app.use('/api/items/parse-haul', aiLimiter);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  return ApiResponse.success(
    res,
    {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      service: 'Shelf Life Backend API',
    },
    'Server is running smoothly'
  );
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/households', householdRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/recipes', recipeRoutes);
app.use('/api/restock', restockRoutes);

// Manual / scheduler trigger for expiry check (protected by ADMIN_JOB_SECRET in production)
const triggerJobAuth = (req, res, next) => {
  const adminHeader = req.headers['x-admin-secret'];
  const jobSecret = process.env.ADMIN_JOB_SECRET;

  if (
    typeof adminHeader === 'string' &&
    typeof jobSecret === 'string' &&
    jobSecret.length > 0
  ) {
    const a = Buffer.from(adminHeader);
    const b = Buffer.from(jobSecret);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return next();
    }
    return next(ApiError.forbidden('Invalid admin job secret'));
  }

  if (isProduction) {
    return next(ApiError.forbidden('Invalid or missing admin job secret'));
  }

  return verifyJWT(req, res, next);
};

app.post('/api/jobs/trigger-expiry-check', triggerJobAuth, async (req, res, next) => {
  try {
    const result = await runExpiryCheck();
    return ApiResponse.success(res, result, 'Expiry check job executed');
  } catch (err) {
    return next(err);
  }
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    statusCode: 404,
  });
});

// Centralized error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    await connectDB();

    // Start background cron jobs
    initExpiryJob();

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🥑 Shelf Life Server running on http://localhost:${PORT}`);
      console.log(`📡 Health Check: http://localhost:${PORT}/api/health\n`);
    });

    return server;
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

// Start if not imported as module
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
