const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema(
  {
    // বাংলা শিরোনাম
    title: {
      type: String,
      required: [true, 'সংবাদের শিরোনাম দিতে হবে'],
      trim: true,
      maxlength: [200, 'শিরোনাম সর্বোচ্চ ২০০ অক্ষরের হতে পারবে'],
      validate: {
        validator: (value) => value.trim().length > 0,
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

    // বাংলা বিবরণ
    description: {
      type: String,
      required: [true, 'সংবাদের বিবরণ দিতে হবে'],
      trim: true,
      maxlength: [2000, 'সংবাদের বিবরণ সর্বোচ্চ ২০০০ অক্ষরের হতে পারবে'],
      validate: {
        validator: (value) => value.trim().length > 0,
        message: 'সংবাদের বিবরণ ফাঁকা রাখা যাবে না',
      },
    },

    // ইংরেজি বিবরণ
    descriptionEn: {
      type: String,
      trim: true,
      default: '',
    },

    // সম্পূর্ণ বাংলা সংবাদ
    content: {
      type: String,
      required: [true, 'সংবাদের বিস্তারিত লিখতে হবে'],
      validate: {
        validator: (value) => value.trim().length > 0,
        message: 'সংবাদের বিস্তারিত ফাঁকা রাখা যাবে না',
      },
    },

    // সম্পূর্ণ ইংরেজি সংবাদ
    contentEn: {
      type: String,
      default: '',
    },

    // সংবাদ বিভাগ
    category: {
      type: String,
      required: [true, 'সংবাদের বিভাগ নির্বাচন করো'],
      enum: [
        'জাতীয়',
        'রাজনীতি',
        'আন্তর্জাতিক',
        'খেলাধুলা',
        'প্রযুক্তি',
        'বিনোদন',
      ],
    },

    // ইংরেজি বিভাগ
    categoryEn: {
      type: String,
      enum: [
        'National',
        'Politics',
        'International',
        'Sports',
        'Technology',
        'Entertainment',
      ],
      default: 'National',
    },
    // RSS সংবাদসূত্রের নাম
    source: {
      type: String,
      default: '',
      trim: true,
    },

    // মূল সংবাদ লিংক — ডুপ্লিকেট শনাক্ত করতে কাজে লাগবে
    sourceUrl: {
      type: String,
      default: '',
      trim: true,
    },

    // সংবাদ প্রকাশের মূল সময়
    sourcePublishedAt: {
      type: Date,
      default: null,
    },

    // সংবাদটি স্বয়ংক্রিয়ভাবে সংগ্রহ করা হয়েছে কি না
    isAutoImported: {
      type: Boolean,
      default: false,
    },
    // সংবাদ ছবির URL
    image: {
      type: String,
      default: '',
    },

    // লেখকের নাম
    author: {
      type: String,
      default: 'NewsToday Desk',
      trim: true,
    },

    // Draft অথবা Published
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },

    // প্রধান সংবাদ হিসেবে দেখানো হবে কি না
    isFeatured: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('News', newsSchema);
