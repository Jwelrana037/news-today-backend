require('dotenv').config();

const mongoose = require('mongoose');

const { importAllNews } = require('./services/internationalNewsService');

const MONGO_URI = process.env.MONGODB_URI;

async function testAutoNews() {
  try {
    if (!MONGO_URI) {
      throw new Error(
        'MONGODB_URI পাওয়া যায়নি। Backend-এর .env ফাইল পরীক্ষা করুন।'
      );
    }

    console.log('MongoDB Atlas-এ সংযোগ করা হচ্ছে...');

    await mongoose.connect(MONGO_URI);

    console.log('✅ MongoDB সংযোগ সফল!');

    const result = await importAllNews();

    console.log('\n📊 Auto News Import-এর ফলাফল:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ পরীক্ষা ব্যর্থ:', error.message);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('MongoDB সংযোগ বন্ধ করা হয়েছে।');
    }
  }
}

testAutoNews();
