const Parser = require('rss-parser');

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'NewsTodayRSSReader/1.0',
  },
  customFields: {
    item: [
      ['media:thumbnail', 'mediaThumbnail'],
      ['media:content', 'mediaContent'],
      ['enclosure', 'enclosure'],
    ],
  },
});

// ========================================
// ১. কুমিল্লার স্থানীয় সংবাদসূত্র
// ========================================
// কোনো স্থানীয় Feed ব্যবহারের আগে তার প্রকৃত RSS URL যাচাই করুন।
// নিচে যাচাই করা Feed URL বসাতে হবে।

const COMILLA_RSS_FEEDS = [
  // উদাহরণ:
  // {
  //   name: 'Local News Source',
  //   url: 'এখানে-যাচাই-করা-RSS-URL',
  // },
];

// ========================================
// ২. বাংলাদেশের জাতীয় সংবাদসূত্র
// ========================================

const NATIONAL_RSS_FEEDS = [
  {
    name: 'The Daily Star',
    url: 'https://www.thedailystar.net/frontpage/rss.xml',
  },
  {
    name: 'bdnews24.com',
    url: 'https://bdnews24.com/?widgetName=rssfeed&widgetId=1150&getXmlFeed=true',
  },
  {
    name: 'BanglaNews24',
    url: 'https://www.banglanews24.com/rss/rss.xml',
  },
  {
    name: 'Jago News 24',
    url: 'https://www.jagonews24.com/rss/rss.xml',
  },
];

// ========================================
// ৩. আন্তর্জাতিক সংবাদসূত্র
// শুধু BBC World ও Al Jazeera
// ========================================

const INTERNATIONAL_RSS_FEEDS = [
  {
    name: 'BBC World',
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
  },
  {
    name: 'Al Jazeera',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
  },
];

// ========================================
// ৪. ছবির URL সংগ্রহ
// ========================================

function extractImage(item) {
  // Enclosure
  if (
    item.enclosure?.url &&
    (!item.enclosure.type || item.enclosure.type.startsWith('image/'))
  ) {
    return item.enclosure.url;
  }

  // Media thumbnail
  const thumbnail = item.mediaThumbnail;

  if (Array.isArray(thumbnail)) {
    for (const media of thumbnail) {
      if (media?.$?.url) return media.$.url;
      if (media?.url) return media.url;
    }
  }

  if (thumbnail?.$?.url) return thumbnail.$.url;
  if (thumbnail?.url) return thumbnail.url;

  // Media content
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

  // HTML-এর ভিতর ছবি
  const htmlFields = [
    item['content:encoded'],
    item.content,
    item.description,
    item.summary,
  ];

  const patterns = [
    /<img[^>]+src=["']([^"']+)["']/i,
    /<img[^>]+data-src=["']([^"']+)["']/i,
    /<img[^>]+srcset=["']([^"'\s,]+)/i,
    /<img[^>]+data-original=["']([^"']+)["']/i,
  ];

  for (const html of htmlFields) {
    if (typeof html !== 'string') continue;

    for (const pattern of patterns) {
      const match = html.match(pattern);

      if (match?.[1]) return match[1];
    }
  }

  // অন্যান্য image field
  const possibleImages = [
    item.image?.url,
    item.image?.link,
    item.image?.href,
    item.image,
    item.imageUrl,
    item.thumbnail,
  ];

  for (const image of possibleImages) {
    if (typeof image === 'string' && /^https?:\/\//i.test(image)) {
      return image;
    }
  }

  return '';
}

// ========================================
// ৫. মূল প্রতিবেদন থেকে Open Graph ছবি
// ========================================

async function fetchArticleImage(articleUrl) {
  if (!articleUrl) return '';

  try {
    const response = await fetch(articleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 NewsToday/1.0',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return '';

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
    console.log('প্রতিবেদন থেকে ছবি পাওয়া যায়নি:', error.message);

    return '';
  }
}

// ========================================
// ৬. শিরোনাম ও সারাংশ পরিষ্কার করা
// ========================================

function cleanText(value) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// ========================================
// ৭. একটি Feed থেকে সংবাদ সংগ্রহ
// ========================================

async function fetchFeedNews(feed, category) {
  try {
    console.log(`সংবাদ সংগ্রহ হচ্ছে: ${feed.name}`);

    const result = await parser.parseURL(feed.url);

    const allItems = [];

    for (const item of result.items || []) {
      const title = cleanText(item.title);
      const sourceUrl = item.link?.trim() || '';

      if (!title || !sourceUrl) continue;

      const summary = cleanText(
        item.contentSnippet ||
          item.summary ||
          item.content ||
          item.description ||
          ''
      );

      let image = extractImage(item);

      // ছবি না থাকলে মূল প্রতিবেদন পরীক্ষা
      if (!image) {
        image = await fetchArticleImage(sourceUrl);
      }

      const publishedDate = item.isoDate ? new Date(item.isoDate) : null;

      allItems.push({
        source: feed.name,
        title,
        summary,
        sourceUrl,
        image,
        sourcePublishedAt:
          publishedDate && !Number.isNaN(publishedDate.getTime())
            ? publishedDate
            : null,

        category,
        categoryEn:
          category === 'কুমিল্লা'
            ? 'Comilla'
            : category === 'জাতীয়'
              ? 'National'
              : 'International',

        isAutoImported: true,
      });
    }

    console.log(`${feed.name}: ${allItems.length}টি সংবাদ পাওয়া গেছে।`);

    return allItems;
  } catch (error) {
    console.error(`${feed.name} Feed Error:`, error.message);

    // একটি Feed ব্যর্থ হলেও অন্য Feed চলবে
    return [];
  }
}

// ========================================
// ৮. একাধিক Feed থেকে সংবাদ সংগ্রহ
// ========================================

async function collectFromFeeds(feeds, category) {
  const results = await Promise.all(
    feeds.map((feed) => fetchFeedNews(feed, category))
  );

  const uniqueNews = new Map();

  for (const newsList of results) {
    for (const item of newsList) {
      const key = item.sourceUrl.split('#')[0].replace(/\/$/, '');

      if (!uniqueNews.has(key)) {
        uniqueNews.set(key, item);
      }
    }
  }

  return Array.from(uniqueNews.values());
}

// ========================================
// ৯. কুমিল্লার সংবাদ সংগ্রহ
// ========================================

async function fetchComillaNews() {
  if (COMILLA_RSS_FEEDS.length === 0) {
    console.warn('কুমিল্লার RSS Feed যোগ করা হয়নি।');

    return [];
  }

  return collectFromFeeds(COMILLA_RSS_FEEDS, 'কুমিল্লা');
}

// ========================================
// ১০. জাতীয় সংবাদ সংগ্রহ
// ========================================

async function fetchNationalNews() {
  return collectFromFeeds(NATIONAL_RSS_FEEDS, 'জাতীয়');
}

// ========================================
// ১১. আন্তর্জাতিক সংবাদ সংগ্রহ
// শুধু BBC World ও Al Jazeera
// ========================================

async function fetchInternationalNews() {
  return collectFromFeeds(INTERNATIONAL_RSS_FEEDS, 'আন্তর্জাতিক');
}

module.exports = {
  fetchComillaNews,
  fetchNationalNews,
  fetchInternationalNews,
};
