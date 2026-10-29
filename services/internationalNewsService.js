const News = require('../models/News');

const {
  fetchComillaNews,
  fetchNationalNews,
  fetchInternationalNews,
  fetchPoliticsNews,
  fetchSportsNews,
  fetchEntertainmentNews,
  fetchTechnologyNews,
} = require('./rssService');

const { translateInternationalNews } = require('./geminiService');

// সব ক্যাটাগরির RSS ফাংশন
const NEWS_CATEGORIES = [
  {
    name: 'কুমিল্লা',
    fetch: fetchComillaNews,
  },
  {
    name: 'জাতীয়',
    fetch: fetchNationalNews,
  },
  {
    name: 'আন্তর্জাতিক',
    fetch: fetchInternationalNews,
  },
  {
    name: 'রাজনীতি',
    fetch: fetchPoliticsNews,
  },
  {
    name: 'খেলাধুলা',
    fetch: fetchSportsNews,
  },
  {
    name: 'বিনোদন',
    fetch: fetchEntertainmentNews,
  },
  {
    name: 'প্রযুক্তি',
    fetch: fetchTechnologyNews,
  },
];

// নির্দিষ্ট ক্যাটাগরির সংবাদ Import
async function importNewsByCategory(categoryConfig) {
  const { name, fetch } = categoryConfig;

  console.log(`\n📰 ${name} সংবাদ সংগ্রহ শুরু হচ্ছে...`);

  let savedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let quotaExceeded = false;

  const rssNews = await fetch();

  console.log(`${name}: মোট ${rssNews.length}টি RSS সংবাদ পাওয়া গেছে।`);

  for (const item of rssNews) {
    try {
      const sourceUrl = item.sourceUrl || item.link || '';

      if (!item.title || !sourceUrl) {
        skippedCount++;
        continue;
      }

      // একই সংবাদ আগে Import হয়েছে কি না পরীক্ষা
      const existingNews = await News.findOne({
        sourceUrl,
      }).select('_id');

      if (existingNews) {
        skippedCount++;
        continue;
      }

      // Gemini দিয়ে বাংলা ও ইংরেজি সংবাদ তৈরি
      const translated = await translateInternationalNews({
        title: item.title,
        summary: item.summary || '',
        category: item.categoryEn || item.category || name,
      });

      const bengaliSummary = translated.summaryBn || translated.titleBn;

      const englishSummary =
        translated.summaryEn ||
        translated.descriptionEn ||
        item.summary ||
        item.title;

      if (!translated.titleBn || !translated.titleEn || !bengaliSummary) {
        throw new Error('সংবাদের শিরোনাম অথবা সারাংশ তৈরি করা যায়নি।');
      }

      const categoryBn = item.category || name;
      const categoryEn =
        item.categoryEn ||
        {
          কুমিল্লা: 'Comilla',
          জাতীয়: 'National',
          আন্তর্জাতিক: 'International',
          রাজনীতি: 'Politics',
          খেলাধুলা: 'Sports',
          বিনোদন: 'Entertainment',
          প্রযুক্তি: 'Technology',
        }[categoryBn] ||
        'News';

      // MongoDB-তে সংবাদ সংরক্ষণ ও প্রকাশ
      await News.create({
        title: translated.titleBn,
        titleEn: translated.titleEn,

        description: bengaliSummary.slice(0, 2000),
        descriptionEn: englishSummary.slice(0, 2000),

        content: [
          translated.titleBn,
          bengaliSummary,
          `মূল সংবাদসূত্র: ${item.source || 'Unknown'}`,
          `মূল প্রতিবেদন: ${sourceUrl}`,
        ].join('\n\n'),

        contentEn: [
          translated.titleEn,
          englishSummary,
          `Original source: ${item.source || 'Unknown'}`,
          `Original report: ${sourceUrl}`,
        ].join('\n\n'),

        image: item.image || '',

        category: categoryBn,
        categoryEn,

        source: item.source || 'RSS',
        sourceUrl,

        sourcePublishedAt: item.sourcePublishedAt || item.publishedAt || null,

        author: `${item.source || 'RSS'} / Automated News`,

        status: 'published',
        isAutoImported: true,
        isReviewed: false,
        isFeatured: false,
        isPriority: false,
      });

      savedCount++;

      console.log(`✅ ${categoryBn}: ${translated.titleBn}`);

      // Gemini API-তে অনুরোধের মধ্যে বিরতি
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (error) {
      const message = String(error.message || error);

      if (
        message.includes('GEMINI_QUOTA_EXCEEDED') ||
        /429|RESOURCE_EXHAUSTED|quota exceeded/i.test(message)
      ) {
        console.error('⏸️ Gemini API quota শেষ হয়েছে।');

        quotaExceeded = true;
        break;
      }

      failedCount++;

      console.error(`❌ ${name} সংবাদ Import ব্যর্থ:`, item.title, message);
    }
  }

  console.log(`\n📊 ${name} সংবাদ Import সম্পন্ন।`);
  console.log(`নতুন প্রকাশিত: ${savedCount}`);
  console.log(`আগেই ছিল/বাদ: ${skippedCount}`);
  console.log(`ব্যর্থ: ${failedCount}`);

  return {
    category: name,
    total: rssNews.length,
    savedCount,
    skippedCount,
    failedCount,
    quotaExceeded,
  };
}

// সব ক্যাটাগরির সংবাদ Import
async function importAllNews() {
  console.log('\n🚀 NewsToday Auto News Import শুরু হচ্ছে...');

  const results = [];

  for (const categoryConfig of NEWS_CATEGORIES) {
    try {
      const result = await importNewsByCategory(categoryConfig);

      results.push(result);

      // Gemini quota শেষ হলে পরের ক্যাটাগরি শুরু হবে না
      if (result.quotaExceeded) {
        console.log('⏸️ Quota-এর কারণে বাকি ক্যাটাগরিগুলো বন্ধ রাখা হয়েছে।');
        break;
      }
    } catch (error) {
      console.error(
        `❌ ${categoryConfig.name} ক্যাটাগরি সংগ্রহ করা যায়নি:`,
        error.message
      );

      results.push({
        category: categoryConfig.name,
        total: 0,
        savedCount: 0,
        skippedCount: 0,
        failedCount: 1,
        quotaExceeded: false,
        error: error.message,
      });
    }
  }

  const summary = results.reduce(
    (total, result) => ({
      total: total.total + result.total,
      savedCount: total.savedCount + result.savedCount,
      skippedCount: total.skippedCount + result.skippedCount,
      failedCount: total.failedCount + result.failedCount,
    }),
    {
      total: 0,
      savedCount: 0,
      skippedCount: 0,
      failedCount: 0,
    }
  );

  console.log('\n🏁 সব ক্যাটাগরির Import প্রক্রিয়া শেষ।');
  console.log(`মোট RSS সংবাদ: ${summary.total}`);
  console.log(`নতুন প্রকাশিত: ${summary.savedCount}`);
  console.log(`আগেই ছিল/বাদ: ${summary.skippedCount}`);
  console.log(`ব্যর্থ: ${summary.failedCount}`);

  return {
    ...summary,
    results,
  };
}

// আগের আন্তর্জাতিক Import ফাংশনটি চালু রাখা হলো
async function importInternationalNews() {
  return importNewsByCategory({
    name: 'আন্তর্জাতিক',
    fetch: fetchInternationalNews,
  });
}

module.exports = {
  importAllNews,
  importInternationalNews,
};
