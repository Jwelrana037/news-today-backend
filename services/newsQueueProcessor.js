const News = require('../models/News');
const NewsQueue = require('../models/NewsQueue');
const { translateInternationalNews } = require('./geminiService');

let isProcessing = false;

// Gemini quota শেষ হলে কত ঘণ্টা অপেক্ষা করবে
const QUOTA_WAIT_HOURS = Number(process.env.GEMINI_QUOTA_WAIT_HOURS || 13);

// সাধারণ ব্যর্থতার ক্ষেত্রে পরের চেষ্টার অপেক্ষা
function getRetryDelayMinutes(attempts) {
  return Math.min(2 ** attempts, 60);
}

// Queue থেকে একটি সংবাদ নিয়ে প্রক্রিয়া করা
async function processNewsQueue() {
  if (isProcessing) {
    console.log('⏳ আগের Queue কাজ চলছে। নতুন কাজ আপাতত বন্ধ।');
    return;
  }

  isProcessing = true;

  let currentItem = null;

  try {
    currentItem = await NewsQueue.findOneAndUpdate(
      {
        status: 'pending',
        nextAttemptAt: { $lte: new Date() },
      },
      {
        $set: { status: 'processing' },
        $inc: { attempts: 1 },
      },
      {
        sort: { createdAt: 1 },
        new: true,
      }
    );

    if (!currentItem) {
      console.log('📭 এখন প্রক্রিয়া করার মতো সংবাদ নেই।');
      return;
    }

    console.log(`📰 সংবাদ প্রক্রিয়া হচ্ছে: ${currentItem.title}`);

    // একই সংবাদ আগে প্রকাশিত হয়ে থাকলে আবার প্রকাশ করব না
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

      console.log('⏭️ সংবাদটি আগে থেকেই আছে।');
      return;
    }

    // Gemini API দিয়ে অনুবাদ
    const translated = await translateInternationalNews({
      title: currentItem.title,
      summary: currentItem.summary || '',
    });

    const englishSummary =
      translated.descriptionEn || currentItem.summary || currentItem.title;

    const bengaliSummary = translated.summaryBn || translated.titleBn;

    if (!translated.titleBn || !bengaliSummary) {
      throw new Error('সংবাদের বাংলা শিরোনাম বা সারাংশ পাওয়া যায়নি।');
    }

    // অনুবাদ করা সংবাদ MongoDB-তে প্রকাশ
    await News.create({
      title: translated.titleBn,
      titleEn: translated.titleEn || currentItem.title,

      description: bengaliSummary.slice(0, 2000),
      descriptionEn: englishSummary,

      content: [
        translated.titleBn,
        bengaliSummary,
        `মূল সংবাদসূত্র: ${currentItem.source}`,
        `মূল প্রতিবেদন: ${currentItem.sourceUrl}`,
      ].join('\n\n'),

      contentEn: [
        translated.titleEn || currentItem.title,
        englishSummary,
        `Original source: ${currentItem.source}`,
        `Original report: ${currentItem.sourceUrl}`,
      ].join('\n\n'),

      image: currentItem.image || '',

      category: 'আন্তর্জাতিক',
      categoryEn: 'International',

      source: currentItem.source,
      sourceUrl: currentItem.sourceUrl,
      sourcePublishedAt: currentItem.sourcePublishedAt || null,

      author: `${currentItem.source} / Automated News`,
      status: 'published',
      isFeatured: false,
      isAutoImported: true,
    });

    currentItem.status = 'completed';
    currentItem.lastError = '';
    await currentItem.save();

    console.log(`✅ সংবাদ প্রকাশিত: ${translated.titleBn}`);
  } catch (error) {
    const message = String(error.message || error);

    if (currentItem) {
      currentItem.lastError = message.slice(0, 2000);

      // Gemini API-এর কোটা শেষ হলে দীর্ঘ সময় অপেক্ষা
      if (
        /GEMINI_QUOTA_EXCEEDED|429|RESOURCE_EXHAUSTED|quota exceeded/i.test(
          message
        )
      ) {
        currentItem.status = 'pending';

        currentItem.nextAttemptAt = new Date(
          Date.now() + QUOTA_WAIT_HOURS * 60 * 60 * 1000
        );

        console.error(
          `⏸️ Gemini API-এর কোটা শেষ। ${QUOTA_WAIT_HOURS} ঘণ্টা পরে আবার চেষ্টা করা হবে।`
        );
      } else if (currentItem.attempts < 5) {
        // সাময়িক সমস্যা হলে ধীরে ধীরে আবার চেষ্টা
        currentItem.status = 'pending';

        const delayMinutes = getRetryDelayMinutes(currentItem.attempts);

        currentItem.nextAttemptAt = new Date(
          Date.now() + delayMinutes * 60 * 1000
        );

        console.error(
          `⚠️ সংবাদ প্রক্রিয়া ব্যর্থ। ${delayMinutes} মিনিট পরে আবার চেষ্টা হবে।`,
          message
        );
      } else {
        // পাঁচবার ব্যর্থ হলে failed হিসেবে রাখা
        currentItem.status = 'failed';

        console.error(
          '❌ সর্বোচ্চ চেষ্টা শেষ। সংবাদটি failed হিসেবে রাখা হয়েছে।',
          message
        );
      }

      try {
        await currentItem.save();
      } catch (saveError) {
        console.error(
          '❌ Queue-এর অবস্থা সংরক্ষণ করা যায়নি:',
          saveError.message
        );
      }
    } else {
      console.error('❌ Queue থেকে সংবাদ নেওয়া যায়নি:', message);
    }
  } finally {
    isProcessing = false;
  }
}

module.exports = { processNewsQueue };
