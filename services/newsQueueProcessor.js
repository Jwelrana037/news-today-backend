const News = require('../models/News');
const NewsQueue = require('../models/NewsQueue');
const NewsSettings = require('../models/NewsSettings');

const { translateInternationalNews } = require('./geminiService');

let isProcessing = false;
let isRecovering = false;
let geminiQuotaBlockedUntil = 0;

const QUOTA_WAIT_HOURS = Math.max(
  1,
  Number(process.env.GEMINI_QUOTA_WAIT_HOURS || 13)
);

const MAX_ATTEMPTS = 5;
const QUEUE_BATCH_SIZE = 200;

// ৩০ মিনিটের বেশি Processing হলে Recovery বিবেচনা করা হবে।
const STUCK_PROCESSING_MINUTES = 30;

// ============================================
// 1. Retry Delay
// ============================================

function getRetryDelayMinutes(attempts) {
  return Math.min(2 ** Math.max(1, attempts), 60);
}

// ============================================
// 2. Error Helpers
// ============================================

function getErrorMessage(error) {
  return String(error?.message || error || 'Unknown error').slice(0, 2000);
}

function isGeminiQuotaError(error) {
  const message = getErrorMessage(error);

  return (
    /GEMINI_QUOTA_EXCEEDED|RESOURCE_EXHAUSTED|quota exceeded|rate.?limit/i.test(
      message
    ) ||
    error?.status === 429 ||
    error?.statusCode === 429 ||
    error?.code === 429
  );
}

// স্থায়ী Data Validation Error-এ Retry প্রয়োজন নেই।
function isPermanentError(error) {
  const message = getErrorMessage(error);

  return (
    error?.name === 'ValidationError' ||
    error?.name === 'CastError' ||
    /Queue item-এ বৈধ title নেই|Queue item-এ sourceUrl নেই|অজানা Category|বাংলা শিরোনাম তৈরি হয়নি|ইংরেজি শিরোনাম পাওয়া যায়নি/i.test(
      message
    )
  );
}

// ============================================
// 3. Category Priority
// ============================================

function getCategoryPriority(category) {
  const priorities = {
    কুমিল্লা: 1,
    জাতীয়: 2,
    রাজনীতি: 3,
    আন্তর্জাতিক: 4,
    খেলাধুলা: 5,
    বিনোদন: 6,
    প্রযুক্তি: 7,
    ভিডিও: 8,
  };

  return priorities[category] ?? 99;
}

const VALID_CATEGORIES = [
  'কুমিল্লা',
  'জাতীয়',
  'রাজনীতি',
  'আন্তর্জাতিক',
  'খেলাধুলা',
  'বিনোদন',
  'প্রযুক্তি',
  'ভিডিও',
];

// ============================================
// 4. Enabled Categories
// ============================================

function getEnabledCategories(settings) {
  const categories = [
    ['comillaEnabled', 'কুমিল্লা'],
    ['nationalEnabled', 'জাতীয়'],
    ['politicsEnabled', 'রাজনীতি'],
    ['internationalEnabled', 'আন্তর্জাতিক'],
    ['sportsEnabled', 'খেলাধুলা'],
    ['entertainmentEnabled', 'বিনোদন'],
    ['technologyEnabled', 'প্রযুক্তি'],
    ['videoEnabled', 'ভিডিও'],
  ];

  return categories
    .filter(([setting]) => settings[setting] !== false)
    .map(([, category]) => category);
}

// ============================================
// 5. English Category Mapping
// ============================================

function getCategoryEnglish(category, categoryEn) {
  if (typeof categoryEn === 'string' && categoryEn.trim()) {
    return categoryEn.trim();
  }

  const categoryMap = {
    কুমিল্লা: 'Comilla',
    জাতীয়: 'National',
    রাজনীতি: 'Politics',
    আন্তর্জাতিক: 'International',
    খেলাধুলা: 'Sports',
    বিনোদন: 'Entertainment',
    প্রযুক্তি: 'Technology',
    ভিডিও: 'Video',
  };

  return categoryMap[category] || 'International';
}

// ============================================
// 6. Recover Stuck Queue Items
// ============================================

async function recoverStuckQueueItems() {
  // একই process-এ একাধিক Recovery চালানো বন্ধ।
  if (isRecovering) {
    return 0;
  }

  isRecovering = true;

  try {
    const recoveryDeadline = new Date(
      Date.now() - STUCK_PROCESSING_MINUTES * 60 * 1000
    );

    const result = await NewsQueue.updateMany(
      {
        status: 'processing',
        processingStartedAt: {
          $ne: null,
          $lt: recoveryDeadline,
        },
      },
      {
        $set: {
          status: 'pending',
          processingStartedAt: null,
          nextAttemptAt: new Date(),
          lastError: 'Processing timeout; item recovered for retry.',
        },
      }
    );

    if (result.modifiedCount > 0) {
      console.log(
        `${result.modifiedCount}টি আটকে থাকা Queue item পুনরায় Pending করা হয়েছে।`
      );
    }

    return result.modifiedCount;
  } catch (error) {
    console.error('Queue Recovery Error:', getErrorMessage(error));
    throw error;
  } finally {
    isRecovering = false;
  }
}

// ============================================
// 7. Process News Queue
// ============================================

async function processNewsQueue() {
  if (isProcessing) {
    return;
  }

  if (Date.now() < geminiQuotaBlockedUntil) {
    console.log('Gemini quota wait চলছে।');
    return;
  }

  isProcessing = true;

  let currentItem = null;

  try {
    // ----------------------------------------
    // Step 1: Read Settings
    // ----------------------------------------

    const settings = await NewsSettings.findOne({
      key: 'autoNews',
    }).lean();

    if (!settings || settings.enabled !== true) {
      return;
    }

    // ----------------------------------------
    // Step 2: Enabled Categories
    // ----------------------------------------

    const enabledCategories = getEnabledCategories(settings);

    if (enabledCategories.length === 0) {
      console.log('কোনো News Category চালু নেই।');
      return;
    }

    // ----------------------------------------
    // Step 3: Find Pending Items
    // ----------------------------------------

    const now = new Date();

    const pendingItems = await NewsQueue.find({
      status: 'pending',
      nextAttemptAt: { $lte: now },
      category: { $in: enabledCategories },
    })
      .sort({ createdAt: 1, _id: 1 })
      .limit(QUEUE_BATCH_SIZE)
      .lean();

    if (pendingItems.length === 0) {
      return;
    }

    pendingItems.sort((a, b) => {
      const priorityDifference =
        getCategoryPriority(a.category) - getCategoryPriority(b.category);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    // ----------------------------------------
    // Step 4: Atomically Claim One Item
    // ----------------------------------------

    for (const item of pendingItems) {
      currentItem = await NewsQueue.findOneAndUpdate(
        {
          _id: item._id,
          status: 'pending',
          nextAttemptAt: { $lte: new Date() },
          category: { $in: enabledCategories },
        },
        {
          $set: {
            status: 'processing',
            processingStartedAt: new Date(),
          },
          $inc: {
            attempts: 1,
          },
        },
        {
          returnDocument: 'after',
          runValidators: true,
        }
      );

      if (currentItem) {
        break;
      }
    }

    if (!currentItem) {
      return;
    }

    console.log(`[${currentItem.category}] Processing: ${currentItem.title}`);

    // ----------------------------------------
    // Step 5: Validate Queue Data
    // ----------------------------------------

    if (typeof currentItem.title !== 'string' || !currentItem.title.trim()) {
      const error = new Error('Queue item-এ বৈধ title নেই।');
      error.permanent = true;
      throw error;
    }

    if (
      typeof currentItem.sourceUrl !== 'string' ||
      !currentItem.sourceUrl.trim()
    ) {
      const error = new Error('Queue item-এ sourceUrl নেই।');
      error.permanent = true;
      throw error;
    }

    if (!VALID_CATEGORIES.includes(currentItem.category)) {
      const error = new Error(`অজানা Category: ${currentItem.category}`);
      error.permanent = true;
      throw error;
    }

    // ----------------------------------------
    // Step 6: Check Existing News
    // ----------------------------------------

    const existingNews = await News.findOne({
      sourceUrl: currentItem.sourceUrl,
    });

    if (existingNews) {
      if (!existingNews.image && currentItem.image) {
        existingNews.image = currentItem.image;
        await existingNews.save();
      }

      currentItem.status = 'completed';
      currentItem.processingStartedAt = null;
      currentItem.lastError = '';

      await currentItem.save();

      console.log('সংবাদটি আগে থেকেই News Collection-এ আছে।');
      return;
    }

    // ----------------------------------------
    // Step 7: Translate News
    // ----------------------------------------

    const translated = await translateInternationalNews({
      title: currentItem.title,
      summary: currentItem.summary || '',
      category: currentItem.category,
    });

    if (!translated || typeof translated !== 'object') {
      throw new Error('Gemini থেকে বৈধ translation পাওয়া যায়নি।');
    }

    const bengaliTitle =
      typeof translated.titleBn === 'string'
        ? translated.titleBn.trim().slice(0, 200)
        : '';

    const englishTitle =
      typeof translated.titleEn === 'string'
        ? translated.titleEn.trim().slice(0, 200)
        : '';

    const bengaliSummary =
      typeof translated.summaryBn === 'string'
        ? translated.summaryBn.trim().slice(0, 2000)
        : '';

    const englishSummary =
      typeof translated.summaryEn === 'string'
        ? translated.summaryEn.trim().slice(0, 2000)
        : typeof translated.descriptionEn === 'string'
          ? translated.descriptionEn.trim().slice(0, 2000)
          : '';

    if (!bengaliTitle) {
      const error = new Error('বাংলা শিরোনাম তৈরি হয়নি।');
      error.permanent = true;
      throw error;
    }

    if (!englishTitle) {
      const error = new Error('ইংরেজি শিরোনাম পাওয়া যায়নি।');
      error.permanent = true;
      throw error;
    }

    // ----------------------------------------
    // Step 8: Prepare Category and Content
    // ----------------------------------------

    const category = currentItem.category;

    const categoryEn = getCategoryEnglish(category, currentItem.categoryEn);

    const source = currentItem.source || 'RSS';

    const bengaliContent = [
      bengaliTitle,
      bengaliSummary,
      `মূল সংবাদসূত্র: ${source}`,
      `মূল প্রতিবেদন: ${currentItem.sourceUrl}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const englishContent = [
      englishTitle,
      englishSummary,
      `Original source: ${source}`,
      `Original report: ${currentItem.sourceUrl}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    // ----------------------------------------
    // Step 9: Review or Auto Publish
    // ----------------------------------------

    const reviewMode = settings.mode !== 'auto';

    const newsData = {
      title: bengaliTitle,
      description: (bengaliSummary || bengaliTitle).slice(0, 2000),
      content: bengaliContent,

      titleEn: englishTitle,
      descriptionEn: (englishSummary || englishTitle).slice(0, 2000),
      contentEn: englishContent,

      category,
      categoryEn,

      source,
      sourceUrl: currentItem.sourceUrl,
      sourcePublishedAt: currentItem.sourcePublishedAt || null,

      image: currentItem.image || '',

      author: `${source} / Automated News`.slice(0, 200),

      status: reviewMode ? 'draft' : 'published',
      isReviewed: false,
      isAutoImported: true,
      isFeatured: false,
    };

    // ----------------------------------------
    // Step 10: Save News
    // ----------------------------------------

    await News.create(newsData);

    // ----------------------------------------
    // Step 11: Mark Queue Completed
    // ----------------------------------------

    currentItem.status = 'completed';
    currentItem.processingStartedAt = null;
    currentItem.lastError = '';

    await currentItem.save();

    if (reviewMode) {
      console.log(`Review-এর জন্য Draft তৈরি হয়েছে: ${bengaliTitle}`);
    } else {
      console.log(`সংবাদ Publish হয়েছে: ${bengaliTitle}`);
    }
  } catch (error) {
    const message = getErrorMessage(error);

    console.error('Queue Processing Error:', message);

    if (!currentItem) {
      return;
    }

    currentItem.lastError = message;
    currentItem.processingStartedAt = null;

    // ----------------------------------------
    // Step 12: Duplicate Key Error
    // ----------------------------------------

    if (error.code === 11000) {
      currentItem.status = 'completed';
      currentItem.lastError = '';

      try {
        await currentItem.save();
        console.log('Duplicate সংবাদ বাদ দেওয়া হয়েছে।');
      } catch (saveError) {
        console.error(
          'Duplicate Queue update ব্যর্থ:',
          getErrorMessage(saveError)
        );
      }

      return;
    }

    // ----------------------------------------
    // Step 13: Gemini Quota Error
    // ----------------------------------------

    if (isGeminiQuotaError(error)) {
      geminiQuotaBlockedUntil = Date.now() + QUOTA_WAIT_HOURS * 60 * 60 * 1000;

      currentItem.status = 'pending';
      currentItem.nextAttemptAt = new Date(geminiQuotaBlockedUntil);

      console.error(
        `Gemini quota/rate limit error। ${QUOTA_WAIT_HOURS} ঘণ্টা পরে retry হবে।`
      );
    } else if (error.permanent || isPermanentError(error)) {
      currentItem.status = 'failed';

      console.error('স্থায়ী Data Error। স্বয়ংক্রিয় Retry করা হবে না।');
    } else if (currentItem.attempts < MAX_ATTEMPTS) {
      // --------------------------------------
      // Step 14: Retry Temporary Errors
      // --------------------------------------

      currentItem.status = 'pending';

      const delayMinutes = getRetryDelayMinutes(currentItem.attempts);

      currentItem.nextAttemptAt = new Date(
        Date.now() + delayMinutes * 60 * 1000
      );

      console.error(`${delayMinutes} মিনিট পরে retry হবে।`);
    } else {
      // --------------------------------------
      // Step 15: Maximum Attempts Reached
      // --------------------------------------

      currentItem.status = 'failed';

      console.error('সর্বোচ্চ retry শেষ। Queue item failed।');
    }

    try {
      await currentItem.save();
    } catch (saveError) {
      console.error('Queue status সংরক্ষণ ব্যর্থ:', getErrorMessage(saveError));
    }
  } finally {
    isProcessing = false;
  }
}

// ============================================
// 8. Export
// ============================================

module.exports = {
  processNewsQueue,
  recoverStuckQueueItems,
};
