const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema(
  {
    // ==========================================
    // বাংলা শিরোনাম
    // ==========================================

    title: {
      type: String,
      required: [true, 'সংবাদের শিরোনাম দিতে হবে'],
      trim: true,
      maxlength: [200, 'শিরোনাম সর্বোচ্চ ২০০ অক্ষরের হতে পারবে'],
      validate: {
        validator: (value) =>
          typeof value === 'string' && value.trim().length > 0,
        message: 'সংবাদের শিরোনাম ফাঁকা রাখা যাবে না',
      },
    },

    // ইংরেজি শিরোনাম
    titleEn: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },

    // ==========================================
    // বাংলা ও ইংরেজি বিবরণ
    // ==========================================

    description: {
      type: String,
      required: [true, 'সংবাদের বিবরণ দিতে হবে'],
      trim: true,
      maxlength: [2000, 'সংবাদের বিবরণ সর্বোচ্চ ২০০০ অক্ষরের হতে পারবে'],
      validate: {
        validator: (value) =>
          typeof value === 'string' && value.trim().length > 0,
        message: 'সংবাদের বিবরণ ফাঁকা রাখা যাবে না',
      },
    },

    descriptionEn: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2000,
    },

    // ==========================================
    // বিস্তারিত সংবাদ
    // ==========================================

    content: {
      type: String,
      required: [true, 'সংবাদের বিস্তারিত লিখতে হবে'],
      validate: {
        validator: (value) =>
          typeof value === 'string' && value.trim().length > 0,
        message: 'সংবাদের বিস্তারিত ফাঁকা রাখা যাবে না',
      },
    },

    contentEn: {
      type: String,
      default: '',
    },

    // ==========================================
    // বাংলা Category
    // ==========================================

    category: {
      type: String,
      required: [true, 'সংবাদের বিভাগ নির্বাচন করো'],
      enum: [
        'কুমিল্লা',
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
      ],
    },

    // ==========================================
    // English Category
    // ==========================================

    categoryEn: {
      type: String,
      enum: [
        'Comilla',
        'National',
        'Politics',
        'International',
        'Sports',
        'Technology',
        'Entertainment',
        'Economy',
        'Education',
        'Crime',
        'Health',
        'Jobs',
        'Religion',
        'Business',
        'Agriculture',
      ],
      default: 'National',
    },

    // ==========================================
    // অবস্থান: বিভাগ, জেলা, উপজেলা
    // ==========================================

    division: {
      type: String,
      enum: [
        '',
        'ঢাকা',
        'চট্টগ্রাম',
        'রাজশাহী',
        'খুলনা',
        'বরিশাল',
        'সিলেট',
        'রংপুর',
        'ময়মনসিংহ',
      ],
      default: '',
      trim: true,
    },

    district: {
      type: String,
      default: '',
      trim: true,
      maxlength: 100,
    },

    upazila: {
      type: String,
      default: '',
      trim: true,
      maxlength: 100,
    },

    // ==========================================
    // সংবাদসূত্র
    // ==========================================

    source: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },

    sourceUrl: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2048,
    },

    sourcePublishedAt: {
      type: Date,
      default: null,
    },

    // ==========================================
    // Auto News System
    // ==========================================

    isAutoImported: {
      type: Boolean,
      default: false,
    },

    isReviewed: {
      type: Boolean,
      default: false,
    },

    // ==========================================
    // ছবি
    // ==========================================

    image: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2048,
    },

    // ==========================================
    // লেখক
    // ==========================================

    author: {
      type: String,
      default: 'NewsToday Desk',
      trim: true,
      maxlength: 200,
    },

    // ==========================================
    // Draft / Published
    // ==========================================

    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
      index: true,
    },

    // প্রধান সংবাদ
    isFeatured: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// ==========================================
// Duplicate Protection
// sourceUrl খালি হলে Unique Index প্রযোজ্য নয়
// ==========================================

newsSchema.index(
  { sourceUrl: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceUrl: { $type: 'string', $gt: '' },
    },
  }
);

// ==========================================
// Category অনুযায়ী সংবাদ খোঁজা
// ==========================================

newsSchema.index({
  status: 1,
  category: 1,
  createdAt: -1,
});

// ==========================================
// জেলা ও উপজেলা অনুযায়ী সংবাদ খোঁজা
// ==========================================

newsSchema.index({
  status: 1,
  division: 1,
  district: 1,
  createdAt: -1,
});

// ==========================================
// Featured News
// ==========================================

newsSchema.index({
  status: 1,
  isFeatured: 1,
  createdAt: -1,
});

// ==========================================
// Model Export
// ==========================================

module.exports = mongoose.model('News', newsSchema);
