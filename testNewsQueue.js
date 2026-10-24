require('dotenv').config();

const mongoose = require('mongoose');
const { collectNewsToQueue } = require('./services/newsQueueService');

async function testNewsQueue() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGO_URI পাওয়া যায়নি।');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB সংযোগ সফল হয়েছে।');

    const result = await collectNewsToQueue();

    console.log('\n📊 Queue পরীক্ষার ফলাফল:');
    console.log(result);
  } catch (error) {
    console.error('❌ পরীক্ষা ব্যর্থ:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 MongoDB সংযোগ বন্ধ হয়েছে।');
  }
}

testNewsQueue();
