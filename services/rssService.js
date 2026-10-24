const Parser = require('rss-parser');

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'NewsPortalRSSReader/1.0',
  },

  customFields: {
    item: [
      ['media:thumbnail', 'mediaThumbnail'],
      ['media:content', 'mediaContent'],
      ['enclosure', 'enclosure'],
    ],
  },
});

// আন্তর্জাতিক সংবাদসূত্র
const RSS_FEEDS = [
  {
    name: 'BBC World',
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
  },
  {
    name: 'Al Jazeera',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
  },
  {
    name: 'DW World',
    url: 'https://rss.dw.com/rdf/rss-en-world',
  },
  {
    name: 'France 24',
    url: 'https://www.france24.com/en/rss',
  },
  {
    name: 'The Guardian World',
    url: 'https://www.theguardian.com/world/rss',
  },
];

// RSS আইটেম থেকে ছবির URL বের করা
function extractImage(item) {
  // ১. Enclosure থেকে ছবি খোঁজা
  if (
    item.enclosure?.url &&
    (!item.enclosure.type || item.enclosure.type.startsWith('image/'))
  ) {
    return item.enclosure.url;
  }

  // ২. Media thumbnail
  const thumbnail = item.mediaThumbnail;

  if (Array.isArray(thumbnail)) {
    for (const media of thumbnail) {
      if (media?.$?.url) return media.$.url;
      if (media?.url) return media.url;
    }
  }

  if (thumbnail?.$?.url) return thumbnail.$.url;
  if (thumbnail?.url) return thumbnail.url;

  // ৩. Media content
  const mediaContent = item.mediaContent;
  const mediaList = Array.isArray(mediaContent)
    ? mediaContent
    : mediaContent
      ? [mediaContent]
      : [];

  for (const media of mediaList) {
    if (media?.$?.url && (!media.$.type || media.$.type.startsWith('image/'))) {
      return media.$.url;
    }

    if (media?.url) return media.url;
  }

  // ৪. বিভিন্ন RSS ফিল্ডে থাকা HTML থেকে ছবি খোঁজা
  const htmlFields = [
    item['content:encoded'],
    item.content,
    item['content:encodedSnippet'],
    item.description,
    item.summary,
  ];

  for (const html of htmlFields) {
    if (typeof html !== 'string' || !html) continue;

    // img src, data-src, srcset বা lazy-loading image
    const patterns = [
      /<img[^>]+src=["']([^"']+)["']/i,
      /<img[^>]+data-src=["']([^"']+)["']/i,
      /<img[^>]+srcset=["']([^"'\s,]+)/i,
      /<img[^>]+data-original=["']([^"']+)["']/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);

      if (match?.[1]) {
        return match[1];
      }
    }
  }

  // ৫. অন্য সম্ভাব্য image ফিল্ড
  const possibleImageFields = [
    item.image?.url,
    item.image?.link,
    item.image?.href,
    item.image,
    item.imageUrl,
    item.thumbnail,
  ];

  for (const image of possibleImageFields) {
    if (typeof image === 'string' && /^https?:\/\//i.test(image)) {
      return image;
    }
  }

  return '';
}

// মূল সংবাদ প্রতিবেদনের পৃষ্ঠা থেকে Open Graph ছবি খোঁজা
async function fetchArticleImage(articleUrl) {
  if (!articleUrl) return '';

  try {
    const response = await fetch(articleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 NewsPortal/1.0',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return '';
    }

    const html = await response.text();

    const patterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);

      if (match?.[1]) {
        return match[1].replace(/&amp;/g, '&');
      }
    }

    return '';
  } catch (error) {
    console.log('মূল প্রতিবেদন থেকে ছবি পাওয়া যায়নি:', error.message);

    return '';
  }
}

// RSS Feed থেকে আন্তর্জাতিক সংবাদ সংগ্রহ
async function fetchInternationalNews() {
  const allNews = [];

  for (const feed of RSS_FEEDS) {
    try {
      console.log(`সংবাদ সংগ্রহ করা হচ্ছে: ${feed.name}`);

      const result = await parser.parseURL(feed.url);

      const newsItems = [];

      for (const item of result.items || []) {
        const articleUrl = item.link || '';

        // প্রথমে RSS থেকে ছবির URL সংগ্রহ করব
        let image = extractImage(item);

        // RSS-এ ছবি না থাকলে শুধু Al Jazeera ও DW-এর মূল পৃষ্ঠা পরীক্ষা করব
        if (
          !image &&
          articleUrl &&
          ['Al Jazeera', 'DW World'].includes(feed.name)
        ) {
          image = await fetchArticleImage(articleUrl);
        }

        newsItems.push({
          source: feed.name,
          title: item.title?.trim() || '',
          summary: item.contentSnippet?.trim() || item.summary?.trim() || '',
          link: articleUrl,
          image,
          publishedAt: item.isoDate ? new Date(item.isoDate) : null,
        });
      }

      allNews.push(...newsItems.filter((item) => item.title && item.link));

      const imageCount = newsItems.filter((item) => item.image).length;

      console.log(`${feed.name} থেকে ${newsItems.length}টি আইটেম পাওয়া গেছে।`);
      console.log(`${imageCount}টি আইটেমে ছবির URL পাওয়া গেছে।`);
    } catch (error) {
      console.error(`${feed.name} থেকে সংবাদ সংগ্রহ করা যায়নি:`, error.message);
    }
  }

  return allNews;
}

module.exports = {
  fetchInternationalNews,
};
