const News = require('../models/News');
const NewsQueue = require('../models/NewsQueue');
const NewsSettings = require('../models/NewsSettings');

const {
  fetchComillaNews,
  fetchNationalNews,
  fetchInternationalNews,
} = require('./rssService');

// ========================================
// RSS Queue Collector
// অগ্রাধিকার: কুমিল্লা → জাতীয় → আন্তর্জাতিক
// ========================================

async function collectNewsToQueue() {
  console.log('\n📥 RSS সংবাদ সংগ্রহ শুরু হচ্ছে...');

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
      console.log('⏸️ Auto News বন্ধ অথবা Settings তৈরি হয়নি।');

      return await getQueueStats({
        total: 0,
        addedCount,
        skippedCount,
        failedCount,
      });
    }

    // Step 2: কোন বিভাগ চালু আছে
    const comillaEnabled = settings.comillaEnabled !== false;

    const nationalEnabled = settings.nationalEnabled === true;

    const internationalEnabled = settings.internationalEnabled === true;

    if (!comillaEnabled && !nationalEnabled && !internationalEnabled) {
      console.log('⏸️ সব RSS বিভাগ বন্ধ।');

      return await getQueueStats({
        total: 0,
        addedCount,
        skippedCount,
        failedCount,
      });
    }

    // Step 3: বিভাগ অনুযায়ী RSS সংগ্রহ
    const rssNews = [];

    // ৩.১ কুমিল্লার সংবাদ আগে সংগ্রহ
    if (comillaEnabled) {
      try {
        const items = await fetchComillaNews();

        const comillaNews = (items || []).map((item) => ({
          ...item,
          category: 'কুমিল্লা',
          categoryEn: 'Comilla',
        }));

        rssNews.push(...comillaNews);

        console.log(`📍 কুমিল্লার সংবাদ পাওয়া গেছে: ${comillaNews.length}`);
      } catch (error) {
        console.error('❌ কুমিল্লার RSS Error:', error.message);
      }
    }

    // ৩.২ জাতীয় সংবাদ
    if (nationalEnabled) {
      try {
        const items = await fetchNationalNews();

        const nationalNews = (items || []).map((item) => ({
          ...item,
          category: 'জাতীয়',
          categoryEn: 'National',
        }));

        rssNews.push(...nationalNews);

        console.log(`🇧🇩 জাতীয় সংবাদ পাওয়া গেছে: ${nationalNews.length}`);
      } catch (error) {
        console.error('❌ জাতীয় RSS Error:', error.message);
      }
    }

    // ৩.৩ আন্তর্জাতিক সংবাদ
    if (internationalEnabled) {
      try {
        const items = await fetchInternationalNews();

        const internationalNews = (items || []).map((item) => ({
          ...item,
          category: 'আন্তর্জাতিক',
          categoryEn: 'International',
        }));

        rssNews.push(...internationalNews);

        console.log(
          `🌍 আন্তর্জাতিক সংবাদ পাওয়া গেছে: ${internationalNews.length}`
        );
      } catch (error) {
        console.error('❌ আন্তর্জাতিক RSS Error:', error.message);
      }
    }

    totalFetched = rssNews.length;

    console.log(`📰 মোট RSS সংবাদ: ${totalFetched}`);

    // Step 4: URL স্বাভাবিক করা ও Duplicate বাদ দেওয়া
    const uniqueNews = new Map();

    for (const item of rssNews) {
      const sourceUrl = normalizeUrl(item.sourceUrl || item.link);

      const title = typeof item.title === 'string' ? item.title.trim() : '';

      if (!sourceUrl || !title) {
        skippedCount++;
        continue;
      }

      const normalizedItem = {
        ...item,
        title,
        sourceUrl,
      };

      // একই URL একাধিক Feed-এ থাকলে প্রথমটিই থাকবে।
      // সংগ্রহের ক্রম: কুমিল্লা, জাতীয়, আন্তর্জাতিক।
      if (!uniqueNews.has(sourceUrl)) {
        uniqueNews.set(sourceUrl, normalizedItem);
      } else {
        skippedCount++;
      }
    }

    // Step 5: Category ও প্রকাশের তারিখ অনুযায়ী সাজানো
    const categoryPriority = {
      কুমিল্লা: 1,
      জাতীয়: 2,
      আন্তর্জাতিক: 3,
    };

    const uniqueItems = [...uniqueNews.values()];

    uniqueItems.sort((a, b) => {
      const priorityA = categoryPriority[a.category] ?? 99;

      const priorityB = categoryPriority[b.category] ?? 99;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      const dateA = new Date(
        a.sourcePublishedAt || a.publishedAt || 0
      ).getTime();

      const dateB = new Date(
        b.sourcePublishedAt || b.publishedAt || 0
      ).getTime();

      return dateB - dateA;
    });

    // Step 6: News ও Queue-তে আগে আছে কি না পরীক্ষা
    for (const item of uniqueItems) {
      try {
        const { title, sourceUrl, category, categoryEn } = item;

        // News collection-এ Duplicate Check
        const existingNews = await News.exists({
          sourceUrl,
        });

        if (existingNews) {
          skippedCount++;
          continue;
        }

        // Queue-তে Duplicate Check
        const existingQueue = await NewsQueue.exists({
          sourceUrl,
        });

        if (existingQueue) {
          skippedCount++;
          continue;
        }

        // Step 7: Queue-তে নতুন সংবাদ যোগ
        await NewsQueue.create({
          source: item.source || 'Unknown',

          sourceUrl,

          title,

          summary: typeof item.summary === 'string' ? item.summary.trim() : '',

          category,

          categoryEn,

          image: item.image || '',

          sourcePublishedAt: item.sourcePublishedAt || item.publishedAt || null,

          status: 'pending',

          nextAttemptAt: new Date(),

          attempts: 0,

          lastError: '',
        });

        addedCount++;

        console.log(`✅ [${category}] Queue-তে যোগ হয়েছে: ${title}`);
      } catch (error) {
        // Unique index-এর কারণে Duplicate হলে
        // নতুন করে Queue-তে যোগ করার চেষ্টা করা হবে না।
        if (error.code === 11000) {
          skippedCount++;
          continue;
        }

        failedCount++;

        console.error(
          `❌ Queue-তে যোগ করা যায়নি: ${item.title}`,
          error.message
        );
      }
    }

    // Step 8: Queue Statistics
    return await getQueueStats({
      total: totalFetched,
      addedCount,
      skippedCount,
      failedCount,
    });
  } catch (error) {
    console.error('❌ RSS Queue সংগ্রহ ব্যর্থ:', error.message);

    throw error;
  }
}

// ========================================
// URL Normalize
// ========================================

function normalizeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return '';
  }

  try {
    const url = new URL(value.trim());

    // URL fragment বাদ
    url.hash = '';

    // সাধারণ tracking parameters বাদ
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

    return url.toString().replace(/\/$/, '');
  } catch {
    return value.trim();
  }
}

// ========================================
// Queue Statistics
// ========================================

async function getQueueStats({ total, addedCount, skippedCount, failedCount }) {
  const [
    pendingCount,
    comillaPendingCount,
    nationalPendingCount,
    internationalPendingCount,
  ] = await Promise.all([
    NewsQueue.countDocuments({
      status: 'pending',
    }),

    NewsQueue.countDocuments({
      status: 'pending',
      category: 'কুমিল্লা',
    }),

    NewsQueue.countDocuments({
      status: 'pending',
      category: 'জাতীয়',
    }),

    NewsQueue.countDocuments({
      status: 'pending',
      category: 'আন্তর্জাতিক',
    }),
  ]);

  console.log('\n📊 RSS Queue সংগ্রহ শেষ।');

  console.log(`মোট পাওয়া গেছে: ${total}`);
  console.log(`নতুন যোগ হয়েছে: ${addedCount}`);
  console.log(`আগেই ছিল/বাদ: ${skippedCount}`);
  console.log(`ব্যর্থ: ${failedCount}`);
  console.log(`মোট অপেক্ষমাণ: ${pendingCount}`);

  console.log(`📍 কুমিল্লা অপেক্ষমাণ: ${comillaPendingCount}`);

  console.log(`🇧🇩 জাতীয় অপেক্ষমাণ: ${nationalPendingCount}`);

  console.log(`🌍 আন্তর্জাতিক অপেক্ষমাণ: ${internationalPendingCount}`);

  return {
    total,
    addedCount,
    skippedCount,
    failedCount,
    pendingCount,
    comillaPendingCount,
    nationalPendingCount,
    internationalPendingCount,
  };
}

module.exports = {
  collectNewsToQueue,
  getQueueStats,
};
