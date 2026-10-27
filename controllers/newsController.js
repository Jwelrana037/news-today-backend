const mongoose = require('mongoose');
const News = require('../models/News');

// ========================================
// 1. সব প্রকাশিত সংবাদ দেখা (Pagination)
// GET /api/news?page=1&limit=10
// ========================================
exports.getPublishedNews = async (req, res) => {
  try {
    const requestedPage = Math.max(1, parseInt(req.query.page, 10) || 1);

    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit, 10) || 10)
    );

    const filter = {
      status: 'published',
    };

    const totalNews = await News.countDocuments(filter);
    const totalPages = Math.ceil(totalNews / limit);

    const currentPage =
      totalPages > 0 ? Math.min(requestedPage, totalPages) : 1;

    const skip = (currentPage - 1) * limit;

    const news = await News.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
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

    return res.status(500).json({
      success: false,
      message: 'সংবাদ লোড করা যায়নি।',
    });
  }
};

// ========================================
// 2. ID দিয়ে একটি প্রকাশিত সংবাদ দেখা
// GET /api/news/:id
// ========================================
exports.getNewsById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'সংবাদের ID সঠিক নয়।',
      });
    }

    const news = await News.findOne({
      _id: id,
      status: 'published',
    });

    if (!news) {
      return res.status(404).json({
        success: false,
        message: 'সংবাদ পাওয়া যায়নি।',
      });
    }

    return res.status(200).json({
      success: true,
      data: news,
    });
  } catch (error) {
    console.error('Get News By ID Error:', error);

    return res.status(500).json({
      success: false,
      message: 'সংবাদ লোড করা যায়নি।',
    });
  }
};

// ========================================
// 3. Admin-এর সব সংবাদ দেখা
// GET /api/news/admin/all
// Admin authentication প্রয়োজন
// ========================================
exports.getAllNewsForAdmin = async (req, res) => {
  try {
    const news = await News.find().sort({ createdAt: -1, _id: -1 });

    return res.status(200).json({
      success: true,
      count: news.length,
      data: news,
    });
  } catch (error) {
    console.error('Get All Admin News Error:', error);

    return res.status(500).json({
      success: false,
      message: 'সংবাদ লোড করা যায়নি।',
    });
  }
};

// ========================================
// 4. নতুন সংবাদ তৈরি
// POST /api/news
// Admin authentication প্রয়োজন
// ========================================
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
      division,
      district,
      upazila,
    } = req.body;

    // প্রয়োজনীয় Field যাচাই
    if (
      typeof title !== 'string' ||
      !title.trim() ||
      typeof description !== 'string' ||
      !description.trim() ||
      typeof content !== 'string' ||
      !content.trim() ||
      typeof category !== 'string' ||
      !category.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Title, Description, Content ও Category আবশ্যক।',
      });
    }

    // বাংলা Category যাচাই
    const validCategories = [
      'জাতীয়',
      'রাজনীতি',
      'আন্তর্জাতিক',
      'খেলাধুলা',
      'প্রযুক্তি',
      'বিনোদন',
      'অর্থনীতি',
      'ব্যবসা-বাণিজ্য',
      'শিক্ষা',
      'অপরাধ',
      'স্বাস্থ্য',
      'চাকরি',
      'ধর্ম',
      'পরিবেশ',
      'কৃষি',
    ];

    if (!validCategories.includes(category.trim())) {
      return res.status(400).json({
        success: false,
        message: 'অনুমোদিত Category নির্বাচন করুন।',
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

    // Featured যাচাই
    if (isFeatured !== undefined && typeof isFeatured !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isFeatured-এর মান true অথবা false হতে হবে।',
      });
    }

    // English Category যাচাই
    const englishCategoryMap = {
      জাতীয়: 'National',
      রাজনীতি: 'Politics',
      আন্তর্জাতিক: 'International',
      খেলাধুলা: 'Sports',
      প্রযুক্তি: 'Technology',
      বিনোদন: 'Entertainment',
      অর্থনীতি: 'Economy',
      'ব্যবসা-বাণিজ্য': 'Business',
      শিক্ষা: 'Education',
      অপরাধ: 'Crime',
      স্বাস্থ্য: 'Health',
      চাকরি: 'Jobs',
      ধর্ম: 'Religion',
      পরিবেশ: 'Environment',
      কৃষি: 'Agriculture',
    };

    const safeCategoryEn = englishCategoryMap[category.trim()];

    // Division যাচাই
    const allowedDivisions = [
      '',
      'ঢাকা',
      'চট্টগ্রাম',
      'রাজশাহী',
      'খুলনা',
      'বরিশাল',
      'সিলেট',
      'রংপুর',
      'ময়মনসিংহ',
    ];

    const safeDivision = division?.trim() || '';

    if (!allowedDivisions.includes(safeDivision)) {
      return res.status(400).json({
        success: false,
        message: 'সঠিক বিভাগ নির্বাচন করুন।',
      });
    }

    const news = await News.create({
      title: title.trim(),
      titleEn: titleEn?.trim() || '',
      description: description.trim(),
      descriptionEn: descriptionEn?.trim() || '',
      content: content.trim(),
      contentEn: contentEn?.trim() || '',
      category: category.trim(),
      categoryEn: safeCategoryEn,
      image: image?.trim() || '',
      author: req.admin?.name || author?.trim() || 'Admin',
      status: status || 'draft',
      isFeatured: isFeatured ?? false,
      division: safeDivision,
      district: district?.trim() || '',
      upazila: upazila?.trim() || '',
    });

    return res.status(201).json({
      success: true,
      message: 'সংবাদ তৈরি হয়েছে।',
      data: news,
    });
  } catch (error) {
    console.error('Create News Error:', error);

    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'এই সংবাদসূত্রের লিংক আগে থেকেই রয়েছে।',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'সংবাদ তৈরি করা যায়নি।',
    });
  }
};

// ========================================
// 5. সংবাদ আপডেট
// PUT /api/news/:id
// Admin authentication প্রয়োজন
// ========================================
exports.updateNews = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'সংবাদের ID সঠিক নয়।',
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
      'division',
      'district',
      'upazila',
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // আপডেট করার মতো Field আছে কি না
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'আপডেট করার জন্য কোনো বৈধ Data পাওয়া যায়নি।',
      });
    }

    // Status যাচাই
    if (
      updates.status !== undefined &&
      !['draft', 'published'].includes(updates.status)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Status অবশ্যই draft অথবা published হতে হবে।',
      });
    }

    // Featured যাচাই
    if (
      updates.isFeatured !== undefined &&
      typeof updates.isFeatured !== 'boolean'
    ) {
      return res.status(400).json({
        success: false,
        message: 'isFeatured-এর মান true অথবা false হতে হবে।',
      });
    }

    // Text Field trim
    const textFields = [
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
      'division',
      'district',
      'upazila',
    ];

    for (const field of textFields) {
      if (typeof updates[field] === 'string') {
        updates[field] = updates[field].trim();
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
        message: 'সংবাদ পাওয়া যায়নি।',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'সংবাদ আপডেট হয়েছে।',
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

// ========================================
// 6. সংবাদ Delete
// DELETE /api/news/:id
// Admin authentication প্রয়োজন
// ========================================
exports.deleteNews = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'সংবাদের ID সঠিক নয়।',
      });
    }

    const news = await News.findByIdAndDelete(id);

    if (!news) {
      return res.status(404).json({
        success: false,
        message: 'সংবাদ পাওয়া যায়নি।',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'সংবাদ Delete হয়েছে।',
    });
  } catch (error) {
    console.error('Delete News Error:', error);

    return res.status(500).json({
      success: false,
      message: 'সংবাদ Delete করা যায়নি।',
    });
  }
};

// ========================================
// 7. Featured News
// GET /api/news/featured
// ========================================
exports.getFeaturedNews = async (req, res) => {
  try {
    const news = await News.find({
      status: 'published',
      isFeatured: true,
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(5);

    return res.status(200).json({
      success: true,
      count: news.length,
      data: news,
    });
  } catch (error) {
    console.error('Get Featured News Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Featured News লোড করা যায়নি।',
    });
  }
};

// ========================================
// 8. Category অনুযায়ী সংবাদ
// GET /api/news/category/:category
// ========================================
exports.getNewsByCategory = async (req, res) => {
  try {
    const category = req.params.category?.trim().toLowerCase();

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
      business: {
        bn: 'ব্যবসা-বাণিজ্য',
        en: 'Business',
      },
      education: {
        bn: 'শিক্ষা',
        en: 'Education',
      },
      health: {
        bn: 'স্বাস্থ্য',
        en: 'Health',
      },
      crime: {
        bn: 'অপরাধ',
        en: 'Crime',
      },
      agriculture: {
        bn: 'কৃষি',
        en: 'Agriculture',
      },
    };

    const selectedCategory = categories[category];

    if (!selectedCategory) {
      return res.status(400).json({
        success: false,
        message: 'সঠিক Category নির্বাচন করুন।',
      });
    }

    const news = await News.find({
      status: 'published',
      $or: [
        { category: selectedCategory.bn },
        { categoryEn: selectedCategory.en },
      ],
    }).sort({ createdAt: -1, _id: -1 });

    return res.status(200).json({
      success: true,
      count: news.length,
      data: news,
    });
  } catch (error) {
    console.error('Get News By Category Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Category অনুযায়ী সংবাদ লোড করা যায়নি।',
    });
  }
};

// ========================================
// 9. Division, District ও Upazila অনুযায়ী সংবাদ
// GET /api/news/location?division=চট্টগ্রাম
// GET /api/news/location?district=কুমিল্লা
// GET /api/news/location?upazila=দাউদকান্দি
// ========================================
exports.getNewsByLocation = async (req, res) => {
  try {
    const { division, district, upazila } = req.query;

    const locationFilter = {};

    // অন্তত একটি Location দিতে হবে
    if (!division && !district && !upazila) {
      return res.status(400).json({
        success: false,
        message: 'Division, District অথবা Upazila দিন।',
      });
    }

    if (division) {
      locationFilter.division = division.trim();
    }

    if (district) {
      locationFilter.district = district.trim();
    }

    if (upazila) {
      locationFilter.upazila = upazila.trim();
    }

    const filter = {
      status: 'published',
      ...locationFilter,
    };

    const requestedPage = Math.max(1, parseInt(req.query.page, 10) || 1);

    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit, 10) || 10)
    );

    const totalNews = await News.countDocuments(filter);
    const totalPages = Math.ceil(totalNews / limit);

    const currentPage =
      totalPages > 0 ? Math.min(requestedPage, totalPages) : 1;

    const news = await News.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((currentPage - 1) * limit)
      .limit(limit);

    return res.status(200).json({
      success: true,
      count: news.length,
      totalNews,
      currentPage,
      totalPages,
      limit,
      filters: locationFilter,
      data: news,
    });
  } catch (error) {
    console.error('Get News By Location Error:', error);

    return res.status(500).json({
      success: false,
      message: 'অবস্থান অনুযায়ী সংবাদ লোড করা যায়নি।',
    });
  }
};

// ========================================
// 10. সংবাদ Search
// GET /api/news/search?q=বাংলাদেশ
// ========================================
exports.searchNews = async (req, res) => {
  try {
    const query = req.query.q?.trim();

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'সার্চ করার জন্য কিছু লিখুন।',
      });
    }

    if (query.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'সার্চের শব্দ সর্বোচ্চ ১০০ অক্ষরের হতে পারবে।',
      });
    }

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
        { division: searchRegex },
        { district: searchRegex },
        { upazila: searchRegex },
      ],
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(50);

    return res.status(200).json({
      success: true,
      count: news.length,
      data: news,
    });
  } catch (error) {
    console.error('Search News Error:', error);

    return res.status(500).json({
      success: false,
      message: 'সংবাদ Search করা যায়নি।',
    });
  }
};

// ========================================
// 11. News Image Upload
// POST /api/news/upload-image
// ========================================
exports.uploadNewsImage = async (req, res) => {
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
    console.error('Upload News Image Error:', error);

    return res.status(500).json({
      success: false,
      message: 'ছবি Upload করা যায়নি।',
    });
  }
};
