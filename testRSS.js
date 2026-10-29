const { fetchComillaNews } = require('./services/rssService');

async function testRSS() {
  try {
    console.log('RSS পরীক্ষা শুরু হচ্ছে...\n');

    const news = await fetchComillaNews();

    console.log('\nমোট সংবাদ পাওয়া গেছে:', news.length);

    console.log(JSON.stringify(news.slice(0, 3), null, 2));
  } catch (error) {
    console.error('RSS পরীক্ষা ব্যর্থ:', error.message);
  }
}

testRSS();
