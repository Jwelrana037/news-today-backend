const News = require('../models/News');
const NewsQueue = require('../models/NewsQueue');
const NewsSettings = require('../models/NewsSettings');

const {
  fetchComillaNews,
  fetchNationalNews,
  fetchInternationalNews,
  fetchPoliticsNews,
  fetchSportsNews,
  fetchEntertainmentNews,
  fetchTechnologyNews,
} = require('./rssService');

// ========================================
// 1. Category Configuration
// অগ্রাধিকার:
// কুমিল্লা → জাতীয় → রাজনীতি → আন্তর্জাতিক
// → খেলাধুলা → বিনোদন → প্রযুক্তি
// ========================================

const NEWS_CATEGORIES = [
  {
    key: 'comilla',
    name: 'কুমিল্লা',
    nameEn: 'Comilla',
    enabledSetting: 'comillaEnabled',
    fetch: fetchComillaNews,
    priority: 1,
  },
  {
    key: 'national',
    name: 'জাতীয়',
    nameEn: 'National',
    enabledSetting: 'nationalEnabled',
    fetch: fetchNationalNews,
    priority: 2,
  },
  {
    key: 'politics',
    name: 'রাজনীতি',
    nameEn: 'Politics',
    enabledSetting: 'politicsEnabled',
    fetch: fetchPoliticsNews,
    priority: 3,
  },
  {
    key: 'international',
    name: 'আন্তর্জাতিক',
    nameEn: 'International',
    enabledSetting: 'internationalEnabled',
    fetch: fetchInternationalNews,
    priority: 4,
  },
  {
    key: 'sports',
    name: 'খেলাধুলা',
    nameEn: 'Sports',
    enabledSetting: 'sportsEnabled',
    fetch: fetchSportsNews,
    priority: 5,
  },
  {
    key: 'entertainment',
    name: 'বিনোদন',
    nameEn: 'Entertainment',
    enabledSetting: 'entertainmentEnabled',
    fetch: fetchEntertainmentNews,
    priority: 6,
  },
  {
    key: 'technology',
    name: 'প্রযুক্তি',
    nameEn: 'Technology',
    enabledSetting: 'technologyEnabled',
    fetch: fetchTechnologyNews,
    priority: 7,
  },
];

// ========================================
// 2. Helper: Normalize URL
// ========================================

function normalizeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return '';
  }

  try {
    const url = new URL(value.trim());

    // কেবল HTTP/HTTPS URL গ্রহণ করা হবে।
    if (!['http:', 'https:'].includes(url.protocol)) {
      return '';
    }

    // Credentials-সহ URL গ্রহণ করা হবে না।
    if (url.username || url.password) {
      return '';
    }

    // Fragment বাদ দেওয়া।
    url.hash = '';

    // Tracking parameters বাদ দেওয়া।
    const trackingParameters = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid',
    ];

    for (const parameter of trackingParameters) {
      url.searchParams.delete(parameter);
    }

    // URL-এর শেষের slash সরানো।
    let normalizedUrl = url.toString();

    if (normalizedUrl.endsWith('/')) {
      normalizedUrl = normalizedUrl.slice(0, -1);
    }

    // NewsQueue schema-তে sourceUrl-এর সর্বোচ্চ দৈর্ঘ্য 2048।
    if (normalizedUrl.length > 2048) {
      return '';
    }

    return normalizedUrl;
  } catch {
    // Invalid URL-কে raw string হিসেবে গ্রহণ করা হবে না।
    return '';
  }
}

// ========================================
// 3. Helper: Normalize Date
// ========================================

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

// ========================================
// 4. RSS Queue Collector
// ========================================

async function collectNewsToQueue() {
  console.log('\nRSS সংবাদ সংগ্রহ শুরু হচ্ছে...');

  let addedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let totalFetched = 0;

  try {
    // Step 1: Auto News Settings
    const settings = await NewsSettings.findOne({
      key: 'autoNews',
    });

    if (!settings || settings.enabled !== true) {
      console.log('Auto News বন্ধ অথবা Settings তৈরি হয়নি।');

      return await getQueueStats({
        total: 0,
        addedCount,
        skippedCount,
        failedCount,
      });
    }

    // Step 2: Enabled Categories
    //
    // Settings document-এ কোনো নতুন field না থাকলে
    // সেটিকে enabled হিসেবে বিবেচনা করা হচ্ছে।
    const enabledCategories = NEWS_CATEGORIES.filter(
      (category) => settings[category.enabledSetting] !== false
    );

    if (enabledCategories.length === 0) {
      console.log('কোনো RSS বিভাগ চালু নেই।');

      return await getQueueStats({
        total: 0,
        addedCount,
        skippedCount,
        failedCount,
      });
    }

    // Step 3: RSS Feed থেকে সংবাদ সংগ্রহ
    const rssNews = [];

    for (const category of enabledCategories) {
      try {
        console.log(`${category.name} সংবাদ সংগ্রহ হচ্ছে...`);

        const items = await category.fetch();

        if (!Array.isArray(items)) {
          console.warn(`${category.name}: RSS service array ফেরত দেয়নি।`);

          failedCount++;
          continue;
        }

        const categoryNews = items.map((item) => ({
          ...item,
          category: category.name,
          categoryEn: category.nameEn,
        }));

        rssNews.push(...categoryNews);

        console.log(
          `${category.name}: ${categoryNews.length}টি সংবাদ পাওয়া গেছে।`
        );
      } catch (error) {
        failedCount++;

        console.error(`${category.name} RSS Error:`, error.message);
      }
    }

    totalFetched = rssNews.length;

    console.log(`মোট RSS সংবাদ পাওয়া গেছে: ${totalFetched}`);

    // Step 4: Validate এবং Deduplicate RSS Items
    const uniqueNews = new Map();

    for (const item of rssNews) {
      if (!item || typeof item !== 'object') {
        skippedCount++;
        continue;
      }

      const sourceUrl = normalizeUrl(item.sourceUrl || item.link);

      const title = typeof item.title === 'string' ? item.title.trim() : '';

      // প্রয়োজনীয় তথ্য না থাকলে বাদ।
      if (!sourceUrl || !title) {
        skippedCount++;
        continue;
      }

      // NewsQueue schema-তে title-এর সর্বোচ্চ দৈর্ঘ্য 500।
      if (title.length > 500) {
        skippedCount++;
        console.warn('অতিরিক্ত লম্বা title বাদ দেওয়া হয়েছে।');
        continue;
      }

      const normalizedItem = {
        ...item,
        title,
        sourceUrl,
      };

      // একই URL একবারই রাখা হবে।
      if (uniqueNews.has(sourceUrl)) {
        skippedCount++;
        continue;
      }

      uniqueNews.set(sourceUrl, normalizedItem);
    }

    // Step 5: Category Priority এবং Publication Date
    const categoryPriority = Object.fromEntries(
      NEWS_CATEGORIES.map((category) => [category.name, category.priority])
    );

    const uniqueItems = [...uniqueNews.values()];

    uniqueItems.sort((a, b) => {
      const priorityA = categoryPriority[a.category] ?? 99;
      const priorityB = categoryPriority[b.category] ?? 99;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      const dateA =
        normalizeDate(a.sourcePublishedAt || a.publishedAt)?.getTime() || 0;

      const dateB =
        normalizeDate(b.sourcePublishedAt || b.publishedAt)?.getTime() || 0;

      return dateB - dateA;
    });

    // Step 6: Database Duplicate Check
    for (const item of uniqueItems) {
      try {
        const { title, sourceUrl, category, categoryEn } = item;

        // Published/Draft News-এ আগে থেকেই থাকলে বাদ।
        const existingNews = await News.exists({
          sourceUrl,
        });

        if (existingNews) {
          skippedCount++;
          continue;
        }

        // Queue-তে আগে থেকেই থাকলে বাদ।
        const existingQueue = await NewsQueue.exists({
          sourceUrl,
        });

        if (existingQueue) {
          skippedCount++;
          continue;
        }

        // Step 7: Validate Queue Fields
        const source =
          typeof item.source === 'string' && item.source.trim()
            ? item.source.trim().slice(0, 200)
            : 'Unknown';

        const summary =
          typeof item.summary === 'string'
            ? item.summary.trim().slice(0, 5000)
            : '';

        const image =
          typeof item.image === 'string'
            ? item.image.trim().slice(0, 2048)
            : '';

        const sourcePublishedAt = normalizeDate(
          item.sourcePublishedAt || item.publishedAt
        );

        // Step 8: Queue-তে সংবাদ যোগ
        await NewsQueue.create({
          source,
          sourceUrl,
          title,
          summary,
          category,
          categoryEn,
          image,
          sourcePublishedAt,
          status: 'pending',
          nextAttemptAt: new Date(),
          attempts: 0,
          lastError: '',
        });

        addedCount++;

        console.log(`[${category}] Queue-তে যোগ হয়েছে: ${title}`);
      } catch (error) {
        // Concurrent Collector অথবা unique index-এর কারণে
        // একই URL insert হলে duplicate হিসেবে গণ্য হবে।
        if (error.code === 11000) {
          skippedCount++;
          continue;
        }

        failedCount++;

        console.error(`Queue-তে যোগ করা যায়নি: ${item.title}`, error.message);
      }
    }

    // Step 9: Statistics
    return await getQueueStats({
      total: totalFetched,
      addedCount,
      skippedCount,
      failedCount,
    });
  } catch (error) {
    console.error('RSS Queue সংগ্রহ ব্যর্থ:', error.message);

    throw error;
  }
}

// ========================================
// 5. Queue Statistics
// ========================================

async function getQueueStats({
  total = 0,
  addedCount = 0,
  skippedCount = 0,
  failedCount = 0,
} = {}) {
  const [
    pendingCount,
    completedCount,
    failedQueueCount,
    processingCount,
    ...categoryPendingCounts
  ] = await Promise.all([
    NewsQueue.countDocuments({
      status: 'pending',
    }),

    NewsQueue.countDocuments({
      status: 'completed',
    }),

    NewsQueue.countDocuments({
      status: 'failed',
    }),

    NewsQueue.countDocuments({
      status: 'processing',
    }),

    ...NEWS_CATEGORIES.map((category) =>
      NewsQueue.countDocuments({
        status: 'pending',
        category: category.name,
      })
    ),
  ]);

  const categoryStats = {};

  NEWS_CATEGORIES.forEach((category, index) => {
    categoryStats[`${category.key}PendingCount`] = categoryPendingCounts[index];
  });

  console.log('\nRSS Queue সংগ্রহ শেষ।');
  console.log(`মোট পাওয়া গেছে: ${total}`);
  console.log(`নতুন যোগ হয়েছে: ${addedCount}`);
  console.log(`আগেই ছিল/বাদ: ${skippedCount}`);
  console.log(`সংগ্রহে ব্যর্থ: ${failedCount}`);
  console.log(`অপেক্ষমাণ: ${pendingCount}`);
  console.log(`প্রসেস চলছে: ${processingCount}`);
  console.log(`প্রসেস সম্পন্ন: ${completedCount}`);
  console.log(`Queue-তে ব্যর্থ: ${failedQueueCount}`);

  for (const category of NEWS_CATEGORIES) {
    console.log(
      `${category.name} অপেক্ষমাণ: ` +
        `${categoryStats[`${category.key}PendingCount`]}`
    );
  }

  return {
    total,
    addedCount,
    skippedCount,
    failedCount,
    pendingCount,
    processingCount,
    completedCount,
    failedQueueCount,
    ...categoryStats,
  };
}

// ========================================
// 6. Exports
// ========================================

module.exports = {
  collectNewsToQueue,
  getQueueStats,
};
