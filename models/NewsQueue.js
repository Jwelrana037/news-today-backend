const mongoose = require('mongoose');

const newsQueueSchema = new mongoose.Schema(
  {
    // সংবাদসূত্রের নাম
    source: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    // মূল সংবাদ লিংক
    sourceUrl: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 2048,
    },

    // মূল সংবাদ শিরোনাম
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    // মূল সংবাদ সারাংশ
    summary: {
      type: String,
      default: '',
      trim: true,
      maxlength: 5000,
    },

    // বাংলা সংবাদ বিভাগ
    category: {
      type: String,
      enum: [
        'কুমিল্লা',
        'জাতীয়',
        'রাজনীতি',
        'আন্তর্জাতিক',
        'খেলাধুলা',
        'বিনোদন',
        'প্রযুক্তি',
        'ভিডিও',
      ],
      required: true,
      default: 'আন্তর্জাতিক',
      index: true,
    },

    // ইংরেজি সংবাদ বিভাগ
    categoryEn: {
      type: String,
      enum: [
        'Comilla',
        'National',
        'Politics',
        'International',
        'Sports',
        'Entertainment',
        'Technology',
        'Video',
      ],
      required: true,
      default: 'International',
    },

    // সংবাদে ব্যবহারের ছবি
    image: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2048,
    },

    // মূল সংবাদ প্রকাশের সময়
    sourcePublishedAt: {
      type: Date,
      default: null,
    },

    // Queue-এর বর্তমান অবস্থা
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },

    // কতবার প্রসেস করার চেষ্টা হয়েছে
    attempts: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Attempts অবশ্যই পূর্ণসংখ্যা হতে হবে।',
      },
    },
    processingStartedAt: {
      type: Date,
      default: null,
    },
    // পরবর্তীবার কখন চেষ্টা করা যাবে
    nextAttemptAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // সর্বশেষ ব্যর্থতার কারণ
    lastError: {
      type: String,
      default: '',
      maxlength: 2000,
    },
  },
  {
    timestamps: true,
  }
);

// ============================================
// Indexes
// ============================================

// Pending Queue দ্রুত খুঁজতে
newsQueueSchema.index({
  status: 1,
  nextAttemptAt: 1,
});

// Category এবং status অনুযায়ী Queue খুঁজতে
newsQueueSchema.index({
  category: 1,
  status: 1,
  createdAt: 1,
});

// sourceUrl-এর unique index Schema-তে unique: true থেকে তৈরি হবে।

module.exports = mongoose.model('NewsQueue', newsQueueSchema);
