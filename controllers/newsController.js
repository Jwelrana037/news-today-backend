const mongoose = require('mongoose');
const News = require('../models/News');

// সব প্রকাশিত সংবাদ দেখা
// Get Published News with Pagination
exports.getPublishedNews = async (req, res) => {
  try {
    // Step 1: Page number গ্রহণ
    const requestedPage = Math.max(1, parseInt(req.query.page, 10) || 1);

    // Step 2: প্রতি পেজে কতটি সংবাদ থাকবে
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit, 10) || 10)
    );

    // Step 3: মোট Published News গণনা
    const totalNews = await News.countDocuments({
      status: 'published',
    });

    // Step 4: মোট পেজের সংখ্যা
    const totalPages = Math.ceil(totalNews / limit);

    // Step 5: চাওয়া পেজের সীমা ঠিক রাখা
    const currentPage =
      totalPages > 0 ? Math.min(requestedPage, totalPages) : 1;

    // Step 6: আগের পেজগুলোর সংবাদ বাদ দেওয়া
    const skip = (currentPage - 1) * limit;

    // Step 7: নির্দিষ্ট পেজের সংবাদ সংগ্রহ
    const news = await News.find({
      status: 'published',
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Step 8: Response পাঠানো
    res.status(200).json({
      success: true,
      count: news.length,
      totalNews,
      currentPage,
      totalPages,
      limit,
      data: news,
    });
  } catch (error) {
    console.error('Get Published News Error:', error);

    res.status(500).json({
      success: false,
      message: 'সংবাদ লোড করা যায়নি',
    });
  }
};

// ID দিয়ে একটি প্রকাশিত সংবাদ দেখা
exports.getNewsById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'সংবাদের ID সঠিক নয়',
      });
    }

    const news = await News.findOne({
      _id: id,
      status: 'published',
    });

    if (!news) {
      return res.status(404).json({
        success: false,
        message: 'সংবাদ পাওয়া যায়নি',
      });
    }

    res.status(200).json({
      success: true,
      data: news,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server-এ সমস্যা হয়েছে',
    });
  }
};

// Admin-এর সব সংবাদ দেখা
exports.getAllNewsForAdmin = async (req, res) => {
  try {
    const news = await News.find().sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: news.length,
      data: news,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'সংবাদ লোড করা যায়নি',
    });
  }
};

// নতুন সংবাদ তৈরি
exports.createNews = async (req, res) => {
  try {
    const {
      title,
      titleEn,
      description,
      descriptionEn,
      content,
      contentEn,
      category,
      categoryEn,
      image,
      author,
      status,
      isFeatured,
    } = req.body;

    console.log('Request Body:', req.body);

    if (!title || !description || !content || !category) {
      return res.status(400).json({
        success: false,
        message: 'Title, Description, Content ও Category আবশ্যক',
      });
    }

    // Status যাচাই
    const allowedStatuses = ['draft', 'published'];

    if (status !== undefined && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status অবশ্যই draft অথবা published হতে হবে।',
      });
    }

    // Featured value যাচাই
    if (isFeatured !== undefined && typeof isFeatured !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isFeatured-এর মান true অথবা false হতে হবে।',
      });
    }

    const news = await News.create({
      title,
      titleEn,
      description,
      descriptionEn,
      content,
      contentEn,
      category,
      categoryEn,
      image,
      author: author || req.admin.name,
      status: status || 'draft',
      isFeatured: isFeatured ?? false,
    });

    res.status(201).json({
      success: true,
      message: 'সংবাদ তৈরি হয়েছে',
      data: news,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'সংবাদ তৈরি করা যায়নি',
    });
  }
};

// সংবাদ আপডেট
exports.updateNews = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'সংবাদের ID সঠিক নয়',
      });
    }

    const allowedFields = [
      'title',
      'titleEn',
      'description',
      'descriptionEn',
      'content',
      'contentEn',
      'category',
      'categoryEn',
      'image',
      'author',
      'status',
      'isFeatured',
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const news = await News.findByIdAndUpdate(
      id,
      { $set: updates },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!news) {
      return res.status(404).json({
        success: false,
        message: 'সংবাদ পাওয়া যায়নি',
      });
    }

    res.status(200).json({
      success: true,
      message: 'সংবাদ আপডেট হয়েছে',
      data: news,
    });
  } catch (error) {
    console.error('Update News Error:', error);

    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'সংবাদের Data সঠিক নয়।',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'সংবাদ আপডেট করা যায়নি।',
    });
  }
};

// সংবাদ Delete
exports.deleteNews = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'সংবাদের ID সঠিক নয়',
      });
    }

    const news = await News.findByIdAndDelete(id);

    if (!news) {
      return res.status(404).json({
        success: false,
        message: 'সংবাদ পাওয়া যায়নি',
      });
    }

    res.status(200).json({
      success: true,
      message: 'সংবাদ Delete হয়েছে',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'সংবাদ Delete করা যায়নি',
    });
  }
};

// Featured News দেখানো
exports.getFeaturedNews = async (req, res, next) => {
  try {
    const news = await News.find({
      status: 'published',
      isFeatured: true,
    })
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      count: news.length,
      data: news,
    });
  } catch (error) {
    next(error);
  }
};

// বিভাগ অনুযায়ী প্রকাশিত সংবাদ দেখানো
// Category অনুযায়ী প্রকাশিত সংবাদ দেখানো
exports.getNewsByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;

    // URL slug অনুযায়ী বাংলা ও ইংরেজি Category
    const categories = {
      national: {
        bn: 'জাতীয়',
        en: 'National',
      },
      politics: {
        bn: 'রাজনীতি',
        en: 'Politics',
      },
      international: {
        bn: 'আন্তর্জাতিক',
        en: 'International',
      },
      sports: {
        bn: 'খেলাধুলা',
        en: 'Sports',
      },
      technology: {
        bn: 'প্রযুক্তি',
        en: 'Technology',
      },
      entertainment: {
        bn: 'বিনোদন',
        en: 'Entertainment',
      },
    };

    const selectedCategory = categories[category];

    // Category পাওয়া না গেলে
    if (!selectedCategory) {
      return res.status(400).json({
        success: false,
        message: 'সঠিক Category নির্বাচন করুন।',
      });
    }

    // Database থেকে সংশ্লিষ্ট প্রকাশিত সংবাদ খোঁজা
    const news = await News.find({
      status: 'published',
      $or: [
        { category: selectedCategory.bn },
        { categoryEn: selectedCategory.en },
      ],
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: news.length,
      data: news,
    });
  } catch (error) {
    next(error);
  }
};

// সংবাদ সার্চ করা
exports.searchNews = async (req, res, next) => {
  try {
    const query = req.query.q?.trim();

    // সার্চের শব্দ যাচাই
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'সার্চ করার জন্য কিছু লিখুন।',
      });
    }

    // Regex-এর বিশেষ চিহ্ন Escape করা
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // বাংলা ও ইংরেজি—দুই ভাষাতেই সংবাদ খোঁজা
    const searchRegex = new RegExp(escapedQuery, 'i');

    const news = await News.find({
      status: 'published',
      $or: [
        { title: searchRegex },
        { titleEn: searchRegex },
        { description: searchRegex },
        { descriptionEn: searchRegex },
        { content: searchRegex },
        { contentEn: searchRegex },
        { category: searchRegex },
        { categoryEn: searchRegex },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      count: news.length,
      data: news,
    });
  } catch (error) {
    next(error);
  }
};

// News Image Upload Controller
exports.uploadNewsImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'অনুগ্রহ করে একটি ছবি নির্বাচন করুন।',
      });
    }

    const imagePath = `/uploads/news/${req.file.filename}`;

    return res.status(201).json({
      success: true,
      message: 'ছবি সফলভাবে Upload হয়েছে।',
      data: {
        image: imagePath,
      },
    });
  } catch (error) {
    next(error);
  }
};
