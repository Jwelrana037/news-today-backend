require('dotenv').config();

const mongoose = require('mongoose');

const {
  importInternationalNews,
} = require('./services/internationalNewsService');

const MONGO_URI = process.env.MONGODB_URI;

async function testInternationalNews() {
  try {
    if (!MONGO_URI) {
      throw new Error(
        'MONGO_URI পাওয়া যায়নি। .env ফাইলের MongoDB URI ভেরিয়েবল পরীক্ষা করো।'
      );
    }

    console.log('MongoDB Atlas-এ সংযোগ করা হচ্ছে...');

    await mongoose.connect(MONGO_URI);

    console.log('✅ MongoDB সংযোগ সফল!');

    await importInternationalNews();
  } catch (error) {
    console.error('❌ পরীক্ষা ব্যর্থ:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB সংযোগ বন্ধ করা হয়েছে।');
  }
}

testInternationalNews();
