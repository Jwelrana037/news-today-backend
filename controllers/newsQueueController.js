const mongoose = require('mongoose');
const NewsQueue = require('../models/NewsQueue');
const NewsSettings = require('../models/NewsSettings');

const { collectNewsToQueue } = require('../services/newsQueueService');

// ========================================
// GET /api/admin/news-queue/stats
// Queue Statistics
// ========================================

exports.getNewsQueueStats = async (req, res, next) => {
  try {
    // Step 1: Category ছাড়া Queue Item খুঁজে বের করা
    const categoryAudit = await NewsQueue.aggregate([
      {
        $match: {
          $or: [{ category: null }, { category: { $exists: false } }],
        },
      },
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 },
          sampleTitles: { $push: '$title' },
        },
      },
      {
        $project: {
          source: '$_id',
          count: 1,
          sampleTitles: {
            $slice: ['$sampleTitles', 3],
          },
          _id: 0,
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    console.log('Queue Items Missing Category:', categoryAudit);

    // Step 2: Queue Status অনুযায়ী মোট সংখ্যা বের করা
    const statusCounts = await NewsQueue.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    // Step 3: Category ও Status অনুযায়ী সংখ্যা বের করা
    const categoryCounts = await NewsQueue.aggregate([
      {
        $match: {
          category: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: {
            category: '$category',
            status: '$status',
          },
          count: { $sum: 1 },
        },
      },
    ]);

    // Step 4: বৈধ Queue Status
    const statuses = ['pending', 'processing', 'completed', 'failed'];

    // Step 5: News Category তালিকা
    const categoryNames = [
      'কুমিল্লা',
      'জাতীয়',
      'রাজনীতি',
      'আন্তর্জাতিক',
      'খেলাধুলা',
      'বিনোদন',
      'প্রযুক্তি',
      'ভিডিও',
    ];

    // Step 6: Statistics-এর প্রাথমিক কাঠামো
    const stats = {
      total: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      categories: {},
    };

    // Step 7: প্রতিটি Category-এর প্রাথমিক সংখ্যা
    for (const category of categoryNames) {
      stats.categories[category] = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        total: 0,
      };
    }

    // Step 8: সব Queue Item-এর সামগ্রিক Statistics
    for (const item of statusCounts) {
      // সব Status-এর সংখ্যা যোগ করে মোট Queue বের করা
      stats.total += item.count;

      // নির্ধারিত Status হলে তার সংখ্যা সংরক্ষণ
      if (statuses.includes(item._id)) {
        stats[item._id] = item.count;
      }
    }

    // Step 9: Category অনুযায়ী Statistics
    for (const item of categoryCounts) {
      const category = item._id.category;
      const status = item._id.status;

      // তালিকায় নেই এমন Category বাদ দেওয়া
      if (!stats.categories[category]) {
        continue;
      }

      // নির্ধারিত Status-এর সংখ্যা যোগ করা
      if (statuses.includes(status)) {
        stats.categories[category][status] = item.count;
      }

      // Category-এর মোট Queue Item
      stats.categories[category].total += item.count;
    }

    // Step 10: Response পাঠানো
    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('getNewsQueueStats Error:', error);

    return next(error);
  }
};

// ========================================
// GET /api/admin/news-queue
// Queue-এর সংবাদ তালিকা
// ========================================

exports.getNewsQueue = async (req, res, next) => {
  try {
    const allowedStatuses = ['pending', 'processing', 'completed', 'failed'];

    const { status, category } = req.query;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);

    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit, 10) || 20)
    );

    const filter = {};

    // Status Filter
    if (status) {
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid Queue status.',
        });
      }

      filter.status = status;
    }

    // Category Filter
    if (category) {
      filter.category = category;
    }

    const [total, items] = await Promise.all([
      NewsQueue.countDocuments(filter),

      NewsQueue.find(filter)
        .select(
          'source sourceUrl title summary category categoryEn image sourcePublishedAt status attempts nextAttemptAt processingStartedAt lastError createdAt updatedAt'
        )
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      data: items,
    });
  } catch (error) {
    return next(error);
  }
};

// ========================================
// PATCH /api/admin/news-queue/:id/retry
// Failed সংবাদ পুনরায় Pending করা
// ========================================

exports.retryNewsQueueItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Queue item ID.',
      });
    }

    const item = await NewsQueue.findOneAndUpdate(
      {
        _id: id,
        status: 'failed',
      },
      {
        $set: {
          status: 'pending',
          attempts: 0,
          nextAttemptAt: new Date(),
          processingStartedAt: null,
          lastError: '',
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Failed Queue item পাওয়া যায়নি। Item-এর Status পরীক্ষা করুন।',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Queue item আবার Processing-এর জন্য প্রস্তুত।',
      data: item,
    });
  } catch (error) {
    return next(error);
  }
};

// ========================================
// DELETE /api/admin/news-queue/:id
// Queue থেকে সংবাদ মুছে ফেলা
// ========================================

exports.deleteNewsQueueItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Queue item ID.',
      });
    }

    // Processing অবস্থায় থাকা Item মুছতে দেওয়া হবে না
    const item = await NewsQueue.findOneAndDelete({
      _id: id,
      status: { $ne: 'processing' },
    });

    if (!item) {
      const exists = await NewsQueue.exists({ _id: id });

      if (!exists) {
        return res.status(404).json({
          success: false,
          message: 'Queue item পাওয়া যায়নি।',
        });
      }

      return res.status(409).json({
        success: false,
        message: 'Processing অবস্থায় থাকা Queue item মুছে ফেলা যাবে না।',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Queue item সফলভাবে মুছে ফেলা হয়েছে।',
      data: {
        id: item._id,
        title: item.title,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// ========================================
// POST /api/admin/news-queue/collect
// Manual RSS Collection
// ========================================

exports.collectNewsManually = async (req, res, next) => {
  try {
    const settings = await NewsSettings.findOne({
      key: 'autoNews',
    }).lean();

    if (!settings || settings.enabled !== true) {
      return res.status(400).json({
        success: false,
        message: 'Auto News Settings চালু করুন।',
      });
    }

    const result = await collectNewsToQueue();

    return res.status(200).json({
      success: true,
      message: 'RSS Collection সম্পন্ন হয়েছে।',
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};
