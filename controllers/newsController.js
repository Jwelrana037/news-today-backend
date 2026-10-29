const mongoose = require('mongoose');
const News = require('../models/News');

// ========================================
// 1. Published News দেখা
// GET /api/news?page=1&limit=10
// Priority + Manual + Auto News Sorting
// ========================================
exports.getPublishedNews = async (req, res) => {
  try {
    // Step 1: Pagination Parameters
    const requestedPage = Math.max(1, parseInt(req.query.page, 10) || 1);

    const requestedLimit = Math.max(1, parseInt(req.query.limit, 10) || 10);

    // প্রতি পেজে সর্বোচ্চ ৫০টি News
    const limit = Math.min(requestedLimit, 50);

    const page = requestedPage;
    const skip = (page - 1) * limit;

    // Step 2: বর্তমান সময়
    const now = new Date();

    // Step 3: Published News Filter
    const filter = {
      status: 'published',
    };

    // Step 4: Total Published News Count
    const totalNews = await News.countDocuments(filter);

    // Step 5: Priority অনুযায়ী Sorting
    const result = await News.aggregate([
      // শুধু Published News
      {
        $match: filter,
      },

      // Active Priority এবং Manual News নির্ধারণ
      {
        $addFields: {
          activePriority: {
            $and: [
              {
                $eq: [{ $ifNull: ['$isPriority', false] }, true],
              },
              {
                $gt: ['$priorityUntil', now],
              },
            ],
          },

          isManualNews: {
            $ne: [{ $ifNull: ['$isAutoImported', false] }, true],
          },
        },
      },

      // Sorting Priority
      {
        $sort: {
          activePriority: -1,
          isManualNews: -1,
          createdAt: -1,
          _id: -1,
        },
      },

      // Pagination
      {
        $skip: skip,
      },

      {
        $limit: limit,
      },

      // Internal Sorting Fields বাদ
      {
        $project: {
          activePriority: 0,
          isManualNews: 0,
        },
      },
    ]);

    // Step 6: Total Pages
    const totalPages = Math.ceil(totalNews / limit);

    // Step 7: Response
    return res.status(200).json({
      success: true,
      totalNews,
      currentPage: page,
      totalPages,
      limit,
      data: result,
    });
  } catch (error) {
    console.error('Get Published News Error:', error);

    return res.status(500).json({
      success: false,
      message: 'প্রকাশিত সংবাদ লোড করা যায়নি।',
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
// Create News
// POST /api/news
// Admin authentication প্রয়োজন
// ========================================
exports.createNews = async (req, res) => {
  try {
    // Step 1: Request Body থেকে Data নেওয়া
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
      isPriority,
      priorityUntil,
      division,
      district,
      upazila,
    } = req.body;

    // ========================================
    // Step 2: প্রয়োজনীয় Field যাচাই
    // ========================================
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

    // ========================================
    // Step 3: বাংলা Category যাচাই
    // ========================================
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

    const safeCategory = category.trim();

    if (!validCategories.includes(safeCategory)) {
      return res.status(400).json({
        success: false,
        message: 'অনুমোদিত Category নির্বাচন করুন।',
      });
    }

    // ========================================
    // Step 4: Status যাচাই
    // Admin Draft অথবা Published করতে পারবেন
    // Status না পাঠালে Published হবে
    // ========================================
    const allowedStatuses = ['draft', 'published'];

    if (status !== undefined && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status অবশ্যই draft অথবা published হতে হবে।',
      });
    }

    const finalStatus = status ?? 'published';

    // ========================================
    // Step 5: Featured যাচাই
    // ========================================
    if (
      isFeatured !== undefined &&
      typeof isFeatured !== 'boolean' &&
      !['true', 'false'].includes(isFeatured)
    ) {
      return res.status(400).json({
        success: false,
        message: 'isFeatured-এর মান true অথবা false হতে হবে।',
      });
    }

    const featuredEnabled = isFeatured === true || isFeatured === 'true';

    // ========================================
    // Step 6: Priority যাচাই
    // ========================================
    if (
      isPriority !== undefined &&
      typeof isPriority !== 'boolean' &&
      !['true', 'false'].includes(isPriority)
    ) {
      return res.status(400).json({
        success: false,
        message: 'isPriority-এর মান true অথবা false হতে হবে।',
      });
    }

    const priorityEnabled = isPriority === true || isPriority === 'true';

    // ========================================
    // Step 7: Priority মেয়াদ যাচাই
    // ========================================
    let finalPriorityUntil = null;

    if (priorityEnabled) {
      if (!priorityUntil) {
        return res.status(400).json({
          success: false,
          message: 'Priority News-এর মেয়াদ নির্ধারণ করতে হবে।',
        });
      }

      finalPriorityUntil = new Date(priorityUntil);

      if (
        Number.isNaN(finalPriorityUntil.getTime()) ||
        finalPriorityUntil <= new Date()
      ) {
        return res.status(400).json({
          success: false,
          message: 'Priority News-এর মেয়াদ ভবিষ্যতের হতে হবে।',
        });
      }
    }

    // ========================================
    // Step 8: English Category নির্ধারণ
    // ========================================
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

    const safeCategoryEn = englishCategoryMap[safeCategory];

    // ========================================
    // Step 9: Division যাচাই
    // ========================================
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

    const safeDivision = typeof division === 'string' ? division.trim() : '';

    if (!allowedDivisions.includes(safeDivision)) {
      return res.status(400).json({
        success: false,
        message: 'সঠিক বিভাগ নির্বাচন করুন।',
      });
    }

    // ========================================
    // Step 10: Database-এ News তৈরি
    // ========================================
    const news = await News.create({
      title: title.trim(),

      titleEn: typeof titleEn === 'string' ? titleEn.trim() : '',

      description: description.trim(),

      descriptionEn:
        typeof descriptionEn === 'string' ? descriptionEn.trim() : '',

      content: content.trim(),

      contentEn: typeof contentEn === 'string' ? contentEn.trim() : '',

      category: safeCategory,

      categoryEn:
        typeof categoryEn === 'string' && categoryEn.trim()
          ? categoryEn.trim()
          : safeCategoryEn,

      image: typeof image === 'string' ? image.trim() : '',

      author:
        req.admin?.name ||
        (typeof author === 'string' ? author.trim() : '') ||
        'Admin',

      // Admin-এর নির্বাচিত Status
      status: finalStatus,

      // Featured Feature
      isFeatured: featuredEnabled,

      // Priority Feature
      isPriority: priorityEnabled,
      priorityUntil: finalPriorityUntil,

      // Location Fields
      division: safeDivision,

      district: typeof district === 'string' ? district.trim() : '',

      upazila: typeof upazila === 'string' ? upazila.trim() : '',
    });

    // ========================================
    // Step 11: সফল Response
    // ========================================
    return res.status(201).json({
      success: true,
      message:
        finalStatus === 'published'
          ? 'সংবাদ তৈরি হয়েছে এবং Published হয়েছে।'
          : 'সংবাদ Draft হিসেবে সংরক্ষণ করা হয়েছে।',
      data: news,
    });
  } catch (error) {
    console.error('Create News Error:', error);

    // Mongoose Validation Error
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Duplicate Key Error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'এই সংবাদসূত্রের লিংক আগে থেকেই রয়েছে।',
      });
    }

    // অন্যান্য Error
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

    // Step 1: News ID যাচাই
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'সংবাদের ID সঠিক নয়।',
      });
    }

    // Step 2: আপডেট করার অনুমোদিত Field
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
      'isPriority',
      'priorityUntil',
      'division',
      'district',
      'upazila',
    ];

    // Step 3: Request থেকে Update Data নেওয়া
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Step 4: Update করার মতো Data আছে কি না
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'আপডেট করার জন্য কোনো বৈধ Data পাওয়া যায়নি।',
      });
    }

    // Step 5: বর্তমান News খুঁজে বের করা
    const existingNews = await News.findById(id);

    if (!existingNews) {
      return res.status(404).json({
        success: false,
        message: 'সংবাদ পাওয়া যায়নি।',
      });
    }

    // Step 6: Status যাচাই
    if (
      updates.status !== undefined &&
      !['draft', 'published'].includes(updates.status)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Status অবশ্যই draft অথবা published হতে হবে।',
      });
    }

    // Step 7: Featured যাচাই
    if (
      updates.isFeatured !== undefined &&
      typeof updates.isFeatured !== 'boolean'
    ) {
      return res.status(400).json({
        success: false,
        message: 'isFeatured-এর মান true অথবা false হতে হবে।',
      });
    }

    // Step 8: Priority যাচাই
    if (
      updates.isPriority !== undefined &&
      typeof updates.isPriority !== 'boolean'
    ) {
      return res.status(400).json({
        success: false,
        message: 'isPriority-এর মান true অথবা false হতে হবে।',
      });
    }

    // Step 9: Priority চালু থাকবে কি না নির্ধারণ
    const finalIsPriority =
      updates.isPriority !== undefined
        ? updates.isPriority
        : existingNews.isPriority === true;

    // Step 10: Priority-এর মেয়াদ নির্ধারণ
    let finalPriorityUntil =
      updates.priorityUntil !== undefined
        ? updates.priorityUntil
        : existingNews.priorityUntil;

    if (!finalIsPriority) {
      // Priority বন্ধ হলে মেয়াদ মুছে যাবে
      updates.isPriority = false;
      updates.priorityUntil = null;
    } else {
      // Priority চালু থাকলে ভবিষ্যতের মেয়াদ আবশ্যক
      if (!finalPriorityUntil) {
        return res.status(400).json({
          success: false,
          message: 'Priority News-এর মেয়াদ নির্ধারণ করতে হবে।',
        });
      }

      finalPriorityUntil = new Date(finalPriorityUntil);

      if (
        Number.isNaN(finalPriorityUntil.getTime()) ||
        finalPriorityUntil <= new Date()
      ) {
        return res.status(400).json({
          success: false,
          message: 'Priority News-এর মেয়াদ ভবিষ্যতের হতে হবে।',
        });
      }

      updates.isPriority = true;
      updates.priorityUntil = finalPriorityUntil;
    }

    // Step 11: Text Field Trim
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

    // Step 12: Database-এ Update
    const news = await News.findByIdAndUpdate(
      id,
      { $set: updates },
      {
        new: true,
        runValidators: true,
      }
    );

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
// 8. Category অনুযায়ী Published News
// GET /api/news/category/:category
// Priority + Manual + Auto News Sorting
// ========================================
exports.getNewsByCategory = async (req, res) => {
  try {
    // Step 1: Category গ্রহণ
    const category = req.params.category?.trim().toLowerCase();

    // Step 2: Category Mapping
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

    // Step 3: Category যাচাই
    if (!selectedCategory) {
      return res.status(400).json({
        success: false,
        message: 'সঠিক Category নির্বাচন করুন।',
      });
    }

    // Step 4: বর্তমান সময়
    const now = new Date();

    // Step 5: Category Filter
    const filter = {
      status: 'published',
      $or: [
        { category: selectedCategory.bn },
        { categoryEn: selectedCategory.en },
      ],
    };

    // Step 6: মোট সংবাদ গণনা
    const totalNews = await News.countDocuments(filter);

    // Step 7: Priority অনুযায়ী Sorting
    const news = await News.aggregate([
      {
        $match: filter,
      },

      {
        $addFields: {
          activePriority: {
            $and: [
              {
                $eq: [{ $ifNull: ['$isPriority', false] }, true],
              },
              {
                $gt: ['$priorityUntil', now],
              },
            ],
          },

          isManualNews: {
            $ne: [{ $ifNull: ['$isAutoImported', false] }, true],
          },
        },
      },

      {
        $sort: {
          activePriority: -1,
          isManualNews: -1,
          createdAt: -1,
          _id: -1,
        },
      },

      // অভ্যন্তরীণ Sorting Field Response থেকে বাদ
      {
        $project: {
          activePriority: 0,
          isManualNews: 0,
        },
      },
    ]);

    // Step 8: Response
    return res.status(200).json({
      success: true,
      count: totalNews,
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

// Search News with Priority Sorting
exports.searchNews = async (req, res) => {
  try {
    // Step 1: Search query গ্রহণ
    const query = req.query.q?.trim();

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'সার্চ করার জন্য কিছু লিখুন।',
      });
    }

    // Step 2: Search query validation
    if (query.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'সার্চের শব্দ সর্বোচ্চ ১০০ অক্ষরের হতে পারবে।',
      });
    }

    // Step 3: Regex special characters escape
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escapedQuery, 'i');

    // Step 4: Search filter
    const filter = {
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
    };

    // Step 5: Matching news count
    const totalNews = await News.countDocuments(filter);

    // Step 6: Priority অনুযায়ী সংবাদ সাজানো
    const now = new Date();

    const news = await News.aggregate([
      {
        $match: filter,
      },
      {
        $addFields: {
          // Priority চালু এবং মেয়াদ শেষ হয়নি কি না
          activePriority: {
            $and: [
              {
                $eq: [{ $ifNull: ['$isPriority', false] }, true],
              },
              {
                $gt: ['$priorityUntil', now],
              },
            ],
          },

          // Auto-imported নয় এমন সংবাদকে Manual News ধরা হবে
          isManualNews: {
            $ne: [{ $ifNull: ['$isAutoImported', false] }, true],
          },
        },
      },
      {
        $sort: {
          activePriority: -1,
          isManualNews: -1,
          createdAt: -1,
          _id: -1,
        },
      },
      {
        $limit: 50,
      },
      {
        // Internal sorting fields response থেকে বাদ
        $project: {
          activePriority: 0,
          isManualNews: 0,
        },
      },
    ]);

    // Step 7: Response
    return res.status(200).json({
      success: true,
      count: totalNews,
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
