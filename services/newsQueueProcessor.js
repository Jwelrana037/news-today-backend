const News = require('../models/News');
const NewsQueue = require('../models/NewsQueue');
const NewsSettings = require('../models/NewsSettings');

const { translateInternationalNews } = require('./geminiService');

let isProcessing = false;
let geminiQuotaBlockedUntil = 0;

const QUOTA_WAIT_HOURS = Math.max(
  1,
  Number(process.env.GEMINI_QUOTA_WAIT_HOURS || 13)
);

const MAX_ATTEMPTS = 5;

// ============================================
// Retry Delay
// ============================================

function getRetryDelayMinutes(attempts) {
  return Math.min(2 ** attempts, 60);
}

// ============================================
// Check Gemini Quota Error
// ============================================

function isGeminiQuotaError(message) {
  return /GEMINI_QUOTA_EXCEEDED|429|RESOURCE_EXHAUSTED|quota exceeded|rate.?limit/i.test(
    message
  );
}

// ============================================
// Category Priority
// কুমিল্লা → জাতীয় → আন্তর্জাতিক
// ============================================

function getCategoryPriority(category) {
  const priorities = {
    কুমিল্লা: 1,
    জাতীয়: 2,
    আন্তর্জাতিক: 3,
  };

  return priorities[category] || 99;
}

// ============================================
// Process News Queue
// ============================================

async function processNewsQueue() {
  // একই process-এ একাধিক Queue Processing বন্ধ
  if (isProcessing) {
    return;
  }

  // Gemini quota শেষ হলে নির্দিষ্ট সময় অপেক্ষা
  if (Date.now() < geminiQuotaBlockedUntil) {
    console.log('⏸️ Gemini quota শেষ। অপেক্ষা চলছে।');
    return;
  }

  // গুরুত্বপূর্ণ: Processing শুরু হলে true করতে হবে
  isProcessing = true;

  let currentItem = null;

  try {
    // ========================================
    // Step 1: Read Settings
    // ========================================

    const settings = await NewsSettings.findOne({
      key: 'autoNews',
    }).lean();

    if (!settings || settings.enabled !== true) {
      console.log('⏸️ Auto News বন্ধ অথবা Settings তৈরি হয়নি।');
      return;
    }

    // ========================================
    // Step 2: Enabled Categories
    // ========================================

    const enabledCategories = [];

    if (settings.comillaEnabled !== false) {
      enabledCategories.push('কুমিল্লা');
    }

    if (settings.nationalEnabled === true) {
      enabledCategories.push('জাতীয়');
    }

    if (settings.internationalEnabled === true) {
      enabledCategories.push('আন্তর্জাতিক');
    }

    if (enabledCategories.length === 0) {
      console.log('⏸️ সব News Category বন্ধ।');
      return;
    }

    // ========================================
    // Step 3: Find Pending Queue Items
    // ========================================

    // প্রথমে কুমিল্লা, তারপর জাতীয়, তারপর আন্তর্জাতিক
    // একই Priority-তে পুরোনো সংবাদ আগে
    const pendingItems = await NewsQueue.find({
      status: 'pending',
      nextAttemptAt: { $lte: new Date() },
      category: { $in: enabledCategories },
    })
      .sort({ createdAt: 1 })
      .limit(50)
      .lean();

    if (!pendingItems.length) {
      console.log('📭 প্রসেস করার মতো সংবাদ নেই।');
      return;
    }

    pendingItems.sort((a, b) => {
      const priorityDifference =
        getCategoryPriority(a.category) - getCategoryPriority(b.category);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    // Queue Item-টি atomic update দিয়ে claim করা
    // অন্য process একই item claim করে ফেললে পরের item চেষ্টা হবে
    for (const item of pendingItems) {
      currentItem = await NewsQueue.findOneAndUpdate(
        {
          _id: item._id,
          status: 'pending',
          nextAttemptAt: { $lte: new Date() },
        },
        {
          $set: {
            status: 'processing',
          },
          $inc: {
            attempts: 1,
          },
        },
        {
          returnDocument: 'after',
        }
      );

      if (currentItem) {
        break;
      }
    }

    if (!currentItem) {
      console.log('📭 Queue Item অন্য process নিয়ে নিয়েছে।');
      return;
    }

    console.log(
      `📰 [${currentItem.category}] প্রসেস হচ্ছে: ${currentItem.title}`
    );

    // ========================================
    // Step 4: Validate Queue Data
    // ========================================

    if (typeof currentItem.title !== 'string' || !currentItem.title.trim()) {
      throw new Error('Queue সংবাদে বৈধ শিরোনাম নেই।');
    }

    if (
      typeof currentItem.sourceUrl !== 'string' ||
      !currentItem.sourceUrl.trim()
    ) {
      throw new Error('Queue সংবাদে sourceUrl নেই।');
    }

    // ========================================
    // Step 5: Check Existing News
    // ========================================

    const existingNews = await News.findOne({
      sourceUrl: currentItem.sourceUrl,
    });

    if (existingNews) {
      if (!existingNews.image && currentItem.image) {
        existingNews.image = currentItem.image;
        await existingNews.save();
      }

      currentItem.status = 'completed';
      currentItem.lastError = '';

      await currentItem.save();

      console.log('⏭️ সংবাদটি আগে থেকেই সংরক্ষিত।');
      return;
    }

    // ========================================
    // Step 6: Translate News
    // ========================================

    const translated = await translateInternationalNews({
      title: currentItem.title,
      summary: currentItem.summary || '',
      category: currentItem.category,
    });

    if (!translated || typeof translated !== 'object') {
      throw new Error('Gemini থেকে বৈধ অনুবাদ পাওয়া যায়নি।');
    }

    const bengaliTitle =
      typeof translated.titleBn === 'string' ? translated.titleBn.trim() : '';

    const englishTitle =
      typeof translated.titleEn === 'string'
        ? translated.titleEn.trim()
        : currentItem.title.trim();

    const bengaliSummary =
      typeof translated.summaryBn === 'string'
        ? translated.summaryBn.trim()
        : '';

    const englishSummary =
      typeof translated.summaryEn === 'string'
        ? translated.summaryEn.trim()
        : typeof translated.descriptionEn === 'string'
          ? translated.descriptionEn.trim()
          : currentItem.summary || '';

    if (!bengaliTitle) {
      throw new Error('বাংলা শিরোনাম তৈরি হয়নি।');
    }

    if (!englishTitle) {
      throw new Error('ইংরেজি শিরোনাম পাওয়া যায়নি।');
    }

    // ========================================
    // Step 7: Category Mapping
    // ========================================

    const category = currentItem.category || 'আন্তর্জাতিক';

    const categoryMap = {
      কুমিল্লা: 'Comilla',
      জাতীয়: 'National',
      আন্তর্জাতিক: 'International',
    };

    const categoryEn =
      currentItem.categoryEn || categoryMap[category] || 'International';

    // ========================================
    // Step 8: Review or Auto Publish
    // ========================================

    const reviewMode = settings.mode !== 'auto';

    const newsData = {
      // বাংলা
      title: bengaliTitle,

      description: (bengaliSummary || bengaliTitle).slice(0, 2000),

      content: [
        bengaliTitle,
        bengaliSummary,
        `মূল সংবাদসূত্র: ${currentItem.source || 'RSS'}`,
        `মূল প্রতিবেদন: ${currentItem.sourceUrl}`,
      ]
        .filter(Boolean)
        .join('\n\n'),

      // English
      titleEn: englishTitle,

      descriptionEn: (englishSummary || englishTitle).slice(0, 2000),

      contentEn: [
        englishTitle,
        englishSummary,
        `Original source: ${currentItem.source || 'RSS'}`,
        `Original report: ${currentItem.sourceUrl}`,
      ]
        .filter(Boolean)
        .join('\n\n'),

      // Category
      category,
      categoryEn,

      // Source
      source: currentItem.source || 'RSS',
      sourceUrl: currentItem.sourceUrl,
      sourcePublishedAt: currentItem.sourcePublishedAt || null,

      // Image
      image: currentItem.image || '',

      // Author
      author: `${currentItem.source || 'RSS'} / Automated News`,

      // Review Mode = Draft
      // Auto Mode = Published
      status: reviewMode ? 'draft' : 'published',

      isReviewed: false,
      isAutoImported: true,
      isFeatured: false,
    };

    // ========================================
    // Step 9: Save News
    // ========================================

    await News.create(newsData);

    // ========================================
    // Step 10: Mark Queue Completed
    // ========================================

    currentItem.status = 'completed';
    currentItem.lastError = '';

    await currentItem.save();

    if (reviewMode) {
      console.log(`📝 Review-এর জন্য Draft তৈরি হয়েছে: ${bengaliTitle}`);
    } else {
      console.log(`✅ সংবাদ প্রকাশিত: ${bengaliTitle}`);
    }
  } catch (error) {
    const message = String(error.message || error);

    console.error('❌ Queue Processing Error:', message);

    if (currentItem) {
      currentItem.lastError = message.slice(0, 2000);

      // ======================================
      // Step 11: Duplicate Key Error
      // ======================================

      if (error.code === 11000) {
        currentItem.status = 'completed';
        currentItem.lastError = '';

        try {
          await currentItem.save();
          console.log('⏭️ Duplicate সংবাদ বাদ দেওয়া হয়েছে।');
        } catch (saveError) {
          console.error(
            '❌ Duplicate Queue সংরক্ষণ ব্যর্থ:',
            saveError.message
          );
        }

        return;
      }

      // ======================================
      // Step 12: Gemini Quota Error
      // ======================================

      if (isGeminiQuotaError(message)) {
        geminiQuotaBlockedUntil =
          Date.now() + QUOTA_WAIT_HOURS * 60 * 60 * 1000;

        currentItem.status = 'pending';

        currentItem.nextAttemptAt = new Date(geminiQuotaBlockedUntil);

        console.error(
          `⏸️ Gemini quota/rate limit সমস্যা। ` +
            `${QUOTA_WAIT_HOURS} ঘণ্টা পরে আবার চেষ্টা হবে।`
        );
      } else if (currentItem.attempts < MAX_ATTEMPTS) {
        // ====================================
        // Step 13: Retry Temporary Errors
        // ====================================

        currentItem.status = 'pending';

        const delayMinutes = getRetryDelayMinutes(currentItem.attempts);

        currentItem.nextAttemptAt = new Date(
          Date.now() + delayMinutes * 60 * 1000
        );

        console.error(`⚠️ ${delayMinutes} মিনিট পরে আবার চেষ্টা হবে।`);
      } else {
        // ====================================
        // Step 14: Maximum Attempts Reached
        // ====================================

        currentItem.status = 'failed';

        console.error('❌ সর্বোচ্চ চেষ্টা শেষ। সংবাদটি Failed হয়েছে।');
      }

      try {
        await currentItem.save();
      } catch (saveError) {
        console.error('❌ Queue সংরক্ষণ ব্যর্থ:', saveError.message);
      }
    }
  } finally {
    // সব অবস্থায় Processing Lock মুক্ত হবে
    isProcessing = false;
  }
}

// ============================================
// Export
// ============================================

module.exports = {
  processNewsQueue,
};
