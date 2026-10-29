const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const cron = require('node-cron');

const { collectNewsToQueue } = require('./services/newsQueueService');
const {
  processNewsQueue,
  recoverStuckQueueItems,
} = require('./services/newsQueueProcessor');

const adminRoutes = require('./routes/adminRoutes');
const newsRoutes = require('./routes/newsRoutes');
const connectDB = require('./config/database');
const advertisementRoutes = require('./routes/advertisementRoutes');

const app = express();

// ========================================
// 1. CORS Configuration
// ========================================

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Postman এবং server-to-server request-এর জন্য
      // Origin না থাকলে অনুমতি দেওয়া হবে।
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('CORS origin not allowed'));
    },

    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    allowedHeaders: ['Content-Type', 'Authorization', 'X-Ad-Upload-Type'],
  })
);

// ========================================
// 2. Request Body Limits
// ========================================

app.use(express.json({ limit: '1mb' }));

app.use(
  express.urlencoded({
    extended: true,
    limit: '1mb',
  })
);

// ========================================
// 3. Static Uploaded Images
// ========================================

app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    dotfiles: 'deny',
    index: false,
    maxAge: '1d',
  })
);

// ========================================
// 4. Home Route
// ========================================

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'NewsToday Backend is Running!',
  });
});

// ========================================
// 5. API Routes
// ========================================

app.use('/api/news', newsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/advertisements', advertisementRoutes);

// ========================================
// 6. Handle Unknown Routes
// ========================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint পাওয়া যায়নি।',
  });
});

// ========================================
// 7. Central Error Handler
// ========================================

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

// ========================================
// 8. Scheduler State
// ========================================

// RSS সংগ্রহের আগের কাজ চললে নতুন কাজ শুরু হবে না।
let isCollectingNews = false;

// ========================================
// 9. News Scheduler
// ========================================

function startNewsScheduler() {
  // প্রতি ১৫ মিনিটে RSS থেকে সংবাদ সংগ্রহ।
  cron.schedule('*/15 * * * *', async () => {
    if (isCollectingNews) {
      console.log('আগের RSS সংগ্রহ এখনো চলছে। নতুন সংগ্রহ বাদ দেওয়া হলো।');
      return;
    }

    isCollectingNews = true;

    console.log('\nRSS থেকে নতুন সংবাদ সংগ্রহ শুরু হচ্ছে...');

    try {
      const result = await collectNewsToQueue();

      console.log('RSS সংগ্রহ শেষ হয়েছে।', result || '');
    } catch (error) {
      console.error('RSS সংগ্রহ ব্যর্থ:', error.message);
    } finally {
      isCollectingNews = false;
    }
  });

  // প্রতি মিনিটে Queue থেকে সংবাদ প্রক্রিয়া।
  cron.schedule('* * * * *', async () => {
    try {
      await recoverStuckQueueItems();
      await processNewsQueue();
    } catch (error) {
      console.error('Queue Processor ব্যর্থ:', error.message);
    }
  });

  console.log('News Scheduler চালু হয়েছে।');
  console.log('প্রতি ১৫ মিনিটে RSS সংগ্রহের চেষ্টা হবে।');
  console.log('প্রতি মিনিটে Queue Processor চালানোর চেষ্টা হবে।');
}

// ========================================
// 10. Start Server After Database Connection
// ========================================

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // MongoDB সংযোগ সফল না হলে সার্ভার চালু হবে না।
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`NewsToday Backend running on port ${PORT}`);

      startNewsScheduler();
    });

    server.on('error', (error) => {
      console.error('HTTP Server Error:', error.message);
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();

module.exports = app;
