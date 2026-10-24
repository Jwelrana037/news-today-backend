const News = require('../models/News');

const { fetchInternationalNews } = require('./rssService');
const { translateInternationalNews } = require('./geminiService');

// RSS সংবাদ সংগ্রহ করে MongoDB-তে সংরক্ষণ
async function importInternationalNews() {
  console.log('\n🌍 আন্তর্জাতিক সংবাদ সংগ্রহ শুরু হচ্ছে...');

  let savedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let quotaExceeded = false;

  try {
    const rssNews = await fetchInternationalNews();

    console.log(`মোট ${rssNews.length}টি RSS সংবাদ পাওয়া গেছে।`);

    for (const item of rssNews) {
      try {
        if (!item.title || !item.link) {
          skippedCount++;
          continue;
        }

        // একই সংবাদ আগে সংরক্ষিত হয়েছে কি না পরীক্ষা
        const existingNews = await News.findOne({
          sourceUrl: item.link,
        }).select('_id');

        if (existingNews) {
          console.log(`⏭️ আগেই আছে: ${item.title}`);
          skippedCount++;
          continue;
        }

        // Gemini দিয়ে বাংলা অনুবাদ
        const translated = await translateInternationalNews({
          title: item.title,
          summary: item.summary || '',
        });

        const englishSummary =
          translated.descriptionEn || item.summary || item.title;

        const bengaliSummary = translated.summaryBn || translated.titleBn;

        if (!translated.titleBn || !bengaliSummary) {
          throw new Error('সংবাদের বাংলা শিরোনাম বা সারাংশ পাওয়া যায়নি।');
        }

        // MongoDB-তে সংবাদ প্রকাশ
        await News.create({
          title: translated.titleBn,
          titleEn: translated.titleEn,
          image: item.image || '',
          description: bengaliSummary.slice(0, 2000),
          descriptionEn: englishSummary,

          // RSS-এ পূর্ণ সংবাদ নেই, তাই পূর্ণ প্রতিবেদন হিসেবে উপস্থাপন নয়
          content: [
            translated.titleBn,
            bengaliSummary,
            `মূল সংবাদসূত্র: ${item.source}`,
            `মূল প্রতিবেদন: ${item.link}`,
          ].join('\n\n'),

          contentEn: [
            translated.titleEn,
            englishSummary,
            `Original source: ${item.source}`,
            `Original report: ${item.link}`,
          ].join('\n\n'),

          category: 'আন্তর্জাতিক',
          categoryEn: 'International',

          source: item.source,
          sourceUrl: item.link,
          sourcePublishedAt: item.publishedAt || null,

          author: `${item.source} / Automated News`,
          status: 'published',
          isFeatured: false,
          isAutoImported: true,
        });

        savedCount++;

        console.log(`✅ প্রকাশিত: ${translated.titleBn}`);

        // Gemini API-তে অনুরোধের মধ্যে বিরতি
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch (error) {
        const message = String(error.message || error);

        // কোটা শেষ হলে বর্তমান লুপ বন্ধ হবে
        if (
          message.includes('GEMINI_QUOTA_EXCEEDED') ||
          /429|RESOURCE_EXHAUSTED|quota exceeded/i.test(message)
        ) {
          console.error(
            '⏸️ Gemini API-এর কোটা শেষ। সংবাদ সংগ্রহের এই রান বন্ধ করা হচ্ছে।'
          );

          quotaExceeded = true;
          break;
        }

        failedCount++;

        console.error(`❌ সংবাদ প্রক্রিয়া করা যায়নি: ${item.title}`, message);
      }
    }

    console.log('\n📊 আন্তর্জাতিক সংবাদ সংগ্রহ শেষ।');
    console.log(`নতুন প্রকাশিত: ${savedCount}`);
    console.log(`আগেই ছিল/বাদ: ${skippedCount}`);
    console.log(`ব্যর্থ: ${failedCount}`);

    if (quotaExceeded) {
      console.log(
        'ℹ️ Gemini-এর কোটা পুনরায় পাওয়া গেলে অনুবাদ আবার চেষ্টা করা যাবে।'
      );
    }

    return {
      total: rssNews.length,
      savedCount,
      skippedCount,
      failedCount,
      quotaExceeded,
    };
  } catch (error) {
    console.error('❌ আন্তর্জাতিক সংবাদ সংগ্রহ ব্যর্থ:', error.message);

    throw error;
  }
}

module.exports = {
  importInternationalNews,
};
