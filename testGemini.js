require('dotenv').config();

const { translateInternationalNews } = require('./services/geminiService');

async function testGemini() {
  try {
    const result = await translateInternationalNews({
      title: 'Scientists discover a new species in the ocean',
      summary:
        'Researchers have identified a previously unknown marine species during an ocean expedition.',
    });

    console.log('Gemini Translation Successful!');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Gemini Translation Failed:', error.message);
  }
}

testGemini();
