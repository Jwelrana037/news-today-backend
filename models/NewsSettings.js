const mongoose = require('mongoose');

const newsSettingsSchema = new mongoose.Schema(
  {
    // Settings-এর নির্দিষ্ট পরিচয়
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'autoNews',
      immutable: true,
    },

    // Auto News চালু অথবা বন্ধ
    enabled: {
      type: Boolean,
      default: false,
    },

    // সংবাদ প্রকাশের পদ্ধতি
    mode: {
      type: String,
      enum: ['review', 'auto'],
      default: 'auto',
    },

    // কুমিল্লার সংবাদ
    comillaEnabled: {
      type: Boolean,
      default: true,
    },

    // জাতীয় সংবাদ
    nationalEnabled: {
      type: Boolean,
      default: true,
    },

    // আন্তর্জাতিক সংবাদ
    internationalEnabled: {
      type: Boolean,
      default: true,
    },

    // রাজনীতি
    politicsEnabled: {
      type: Boolean,
      default: true,
    },

    // খেলাধুলা
    sportsEnabled: {
      type: Boolean,
      default: true,
    },

    // বিনোদন
    entertainmentEnabled: {
      type: Boolean,
      default: true,
    },

    // প্রযুক্তি
    technologyEnabled: {
      type: Boolean,
      default: true,
    },

    // ভিডিও
    videoEnabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('NewsSettings', newsSettingsSchema);
