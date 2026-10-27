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
      default: 'review',
    },
    comillaEnabled: {
      type: Boolean,
      default: true,
    },
    // জাতীয় সংবাদ সংগ্রহ চালু অথবা বন্ধ
    nationalEnabled: {
      type: Boolean,
      default: true,
    },

    // আন্তর্জাতিক সংবাদ সংগ্রহ চালু অথবা বন্ধ
    internationalEnabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('NewsSettings', newsSettingsSchema);
