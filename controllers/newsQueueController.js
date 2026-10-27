const NewsQueue = require('../models/NewsQueue');
const NewsSettings = require('../models/NewsSettings');

const { collectNewsToQueue } = require('../services/newsQueueService');

// ========================================
// GET /api/admin/news-queue/stats
// Queue Statistics
// ========================================

exports.getNewsQueueStats = async (req, res) => {
  try {
    const [statusCounts, categoryCounts] = await Promise.all([
      NewsQueue.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),

      NewsQueue.aggregate([
        {
          $group: {
            _id: {
              category: '$category',
              status: '$status',
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const stats = {
      total: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      categories: {
        কুমিল্লা: {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          total: 0,
        },
        জাতীয়: {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          total: 0,
        },
        আন্তর্জাতিক: {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          total: 0,
        },
      },
    };

    for (const item of statusCounts) {
      if (Object.hasOwn(stats, item._id)) {
        stats[item._id] = item.count;
      }

      stats.total += item.count;
    }

    for (const item of categoryCounts) {
      const category = item._id.category;
      const status = item._id.status;

      if (!stats.categories[category]) {
        continue;
      }

      if (Object.hasOwn(stats.categories[category], status)) {
        stats.categories[category][status] = item.count;
      }

      stats.categories[category].total += item.count;
    }

    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('News Queue Statistics Error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'News Queue Statistics পাওয়া যায়নি।',
    });
  }
};

// ========================================
// POST /api/admin/news-queue/collect
// Manual RSS Collection
// ========================================

exports.collectNewsManually = async (req, res) => {
  try {
    // Auto News চালু আছে কি না পরীক্ষা
    const settings = await NewsSettings.findOne({
      key: 'autoNews',
    }).lean();

    if (!settings || settings.enabled !== true) {
      return res.status(400).json({
        success: false,
        message: 'Auto News Settings চালু করুন।',
      });
    }

    // RSS সংগ্রহ শুরু
    const result = await collectNewsToQueue();

    return res.status(200).json({
      success: true,
      message: 'RSS Collection সম্পন্ন হয়েছে।',
      data: result,
    });
  } catch (error) {
    console.error('Manual RSS Collection Error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'RSS Collection ব্যর্থ হয়েছে।',
    });
  }
};
