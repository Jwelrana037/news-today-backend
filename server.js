const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const cron = require('node-cron');
const {
  importInternationalNews,
} = require('./services/internationalNewsService');

const { collectNewsToQueue } = require('./services/newsQueueService');
const { processNewsQueue } = require('./services/newsQueueProcessor');

const adminRoutes = require('./routes/adminRoutes');
const newsRoutes = require('./routes/newsRoutes');
const connectDB = require('./config/database');
const advertisementRoutes = require('./routes/advertisementRoutes');

const app = express();

// Trust proxy only when correctly configured for your hosting.
// Configure this according to your actual deployment environment.

// CORS Configuration
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without Origin, such as Postman or server-to-server.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('CORS origin not allowed'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Request Body Limits
app.use(express.json({ limit: '1mb' }));
app.use(
  express.urlencoded({
    extended: true,
    limit: '1mb',
  })
);

// Static Uploaded Images
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    dotfiles: 'deny',
    index: false,
    maxAge: '1d',
  })
);

// Home Route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'NewsToday Backend is Running!',
  });
});

// API Routes
app.use('/api/news', newsRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api/advertisements', advertisementRoutes);

// Handle Unknown Routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint পাওয়া যায়নি।',
  });
});

// Central Error Handler
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err.message === 'CORS origin not allowed') {
    return res.status(403).json({
      success: false,
      message: 'এই Origin থেকে Request অনুমোদিত নয়।',
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Request-এর আকার অনেক বড়।',
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Request JSON সঠিক নয়।',
    });
  }

  console.error('Server Error:', err);

  return res.status(500).json({
    success: false,
    message: 'সার্ভারে সমস্যা হয়েছে। পরে আবার চেষ্টা করুন।',
  });
});

// Start Server After Database Connection
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`NewsToday Backend running on port ${PORT}`);
      startInternationalNewsScheduler();
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

function startInternationalNewsScheduler() {
  // প্রতি ১৫ মিনিটে RSS থেকে সংবাদ সংগ্রহ
  cron.schedule('*/15 * * * *', async () => {
    console.log('\n⏰ RSS থেকে নতুন সংবাদ সংগ্রহ শুরু হচ্ছে...');

    try {
      await collectNewsToQueue();
    } catch (error) {
      console.error('❌ RSS সংগ্রহ ব্যর্থ:', error.message);
    }
  });

  // প্রতি মিনিটে Queue থেকে একটি সংবাদ প্রক্রিয়া
  cron.schedule('* * * * *', async () => {
    try {
      await processNewsQueue();
    } catch (error) {
      console.error('❌ Queue Processor ব্যর্থ:', error.message);
    }
  });

  console.log('✅ Queue Scheduler চালু হয়েছে।');
  console.log('📥 প্রতি ১৫ মিনিটে RSS সংগ্রহ হবে।');
  console.log('⚙️ প্রতি মিনিটে Queue Processor কাজ করবে।');
}

startServer();
