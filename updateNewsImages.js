require('dotenv').config();

const mongoose = require('mongoose');
const News = require('./models/News');
const { fetchInternationalNews } = require('./services/rssService');

async function updateNewsImages() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGO_URI পাওয়া যায়নি।');
    }

    console.log('MongoDB Atlas-এ সংযোগ করা হচ্ছে...');

    await mongoose.connect(process.env.MONGODB_URI);

    console.log('✅ MongoDB সংযোগ সফল!');

    const rssNews = await fetchInternationalNews();

    let updatedCount = 0;
    let skippedCount = 0;

    for (const item of rssNews) {
      if (!item.link || !item.image) {
        skippedCount++;
        continue;
      }

      const news = await News.findOne({
        sourceUrl: item.link,
      });

      if (!news) {
        skippedCount++;
        continue;
      }

      if (news.image) {
        skippedCount++;
        continue;
      }

      news.image = item.image;
      await news.save();

      updatedCount++;

      console.log(`✅ ছবির URL আপডেট হয়েছে: ${news.title}`);
    }

    console.log('\n📊 কাজ শেষ!');
    console.log(`আপডেট করা হয়েছে: ${updatedCount}`);
    console.log(`বাদ পড়েছে: ${skippedCount}`);
  } catch (error) {
    console.error('❌ সমস্যা হয়েছে:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB সংযোগ বন্ধ করা হয়েছে।');
  }
}

updateNewsImages();
