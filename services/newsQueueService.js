const News = require('../models/News');
const NewsQueue = require('../models/NewsQueue');
const { fetchInternationalNews } = require('./rssService');

// RSS থেকে পাওয়া সংবাদ Queue-তে সংরক্ষণ
async function collectNewsToQueue() {
  console.log('\n📥 RSS সংবাদ Queue-তে যোগ করা হচ্ছে...');

  let addedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  try {
    const rssNews = await fetchInternationalNews();

    console.log(`মোট ${rssNews.length}টি RSS সংবাদ পাওয়া গেছে।`);

    for (const item of rssNews) {
      try {
        if (!item.title || !item.link) {
          skippedCount++;
          continue;
        }

        // আগে থেকেই প্রকাশিত হয়েছে কি না
        const publishedNews = await News.findOne({
          sourceUrl: item.link,
        }).select('_id');

        if (publishedNews) {
          skippedCount++;
          continue;
        }

        // আগে থেকেই Queue-তে আছে কি না
        const queuedNews = await NewsQueue.findOne({
          sourceUrl: item.link,
        }).select('_id');

        if (queuedNews) {
          skippedCount++;
          continue;
        }

        await NewsQueue.create({
          source: item.source,
          sourceUrl: item.link,
          title: item.title,
          summary: item.summary || '',
          image: item.image || '',
          sourcePublishedAt: item.publishedAt || null,
          status: 'pending',
          nextAttemptAt: new Date(),
        });

        addedCount++;

        console.log(`✅ Queue-তে যোগ হয়েছে: ${item.title}`);
      } catch (error) {
        // একই URL একই সময়ে যোগ করার চেষ্টা হলে
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

    const pendingCount = await NewsQueue.countDocuments({
      status: 'pending',
    });

    console.log('\n📊 Queue সংগ্রহ শেষ।');
    console.log(`নতুন যোগ হয়েছে: ${addedCount}`);
    console.log(`আগেই ছিল/বাদ: ${skippedCount}`);
    console.log(`ব্যর্থ: ${failedCount}`);
    console.log(`মোট অপেক্ষমাণ সংবাদ: ${pendingCount}`);

    return {
      total: rssNews.length,
      addedCount,
      skippedCount,
      failedCount,
      pendingCount,
    };
  } catch (error) {
    console.error('❌ RSS Queue সংগ্রহ ব্যর্থ:', error.message);
    throw error;
  }
}

module.exports = {
  collectNewsToQueue,
};
