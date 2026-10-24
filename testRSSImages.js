const https = require('https');

const feeds = [
  {
    name: 'Al Jazeera',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
  },
  {
    name: 'DW World',
    url: 'https://rss.dw.com/rdf/rss-en-world',
  },
];

function fetchXML(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 NewsPortalRSSReader/1.0',
          },
        },
        (response) => {
          let data = '';

          response.setEncoding('utf8');

          response.on('data', (chunk) => {
            data += chunk;
          });

          response.on('end', () => {
            if (
              response.statusCode >= 300 &&
              response.statusCode < 400 &&
              response.headers.location
            ) {
              resolve(fetchXML(response.headers.location));
              return;
            }

            if (response.statusCode !== 200) {
              reject(new Error(`HTTP Status: ${response.statusCode}`));
              return;
            }

            resolve(data);
          });
        }
      )
      .on('error', reject);
  });
}

async function testFeeds() {
  for (const feed of feeds) {
    console.log(`\n========== ${feed.name} ==========`);

    try {
      const xml = await fetchXML(feed.url);

      console.log('XML পাওয়া গেছে:', xml.length, 'characters');

      const imageMatches =
        xml.match(
          /<(?:image|thumbnail|enclosure)\b[^>]*>[\s\S]*?<\/(?:image|thumbnail|enclosure)>|<(?:image|thumbnail|enclosure)\b[^>]*\/>/gi
        ) || [];

      if (imageMatches.length > 0) {
        console.log('\nছবি-সম্পর্কিত XML অংশ:');

        imageMatches.slice(0, 10).forEach((tag) => {
          console.log(tag.slice(0, 1000));
        });
      } else {
        console.log('ছবি-সম্পর্কিত XML অংশ পাওয়া যায়নি।');
      }

      const imgMatches = xml.match(/<img\b[^>]*>/gi) || [];

      if (imgMatches.length > 0) {
        console.log('\nHTML image ট্যাগ:');

        imgMatches.slice(0, 5).forEach((tag) => {
          console.log(tag.slice(0, 500));
        });
      } else {
        console.log('HTML img ট্যাগ পাওয়া যায়নি।');
      }
    } catch (error) {
      console.error('পরীক্ষা ব্যর্থ:', error.message);
    }
  }
}

testFeeds();
