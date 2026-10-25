const mongoose = require('mongoose');

const advertisementSchema = new mongoose.Schema(
  {
    // বিজ্ঞাপনের নাম
    title: {
      type: String,
      required: [true, 'বিজ্ঞাপনের নাম দিতে হবে'],
      trim: true,
      maxlength: [150, 'বিজ্ঞাপনের নাম সর্বোচ্চ ১৫০ অক্ষর হতে পারবে'],
    },

    // বিজ্ঞাপনের ধরন
    type: {
      type: String,
      enum: ['image', 'video', 'animated'],
      default: 'image',
    },

    // পুরোনো বিজ্ঞাপনের ছবির ফিল্ড
    image: {
      type: String,
      trim: true,
      default: '',
    },

    // ভিডিও বিজ্ঞাপনের ফাইল
    video: {
      type: String,
      trim: true,
      default: '',
    },

    // বিজ্ঞাপনে ক্লিক করলে যে লিংকে যাবে
    targetUrl: {
      type: String,
      required: [true, 'বিজ্ঞাপনের লিংক দিতে হবে'],
      trim: true,
      maxlength: 2048,
    },

    // বিজ্ঞাপন কোথায় দেখাবে
    position: {
      type: String,
      enum: [
        // পুরোনো Position — সামঞ্জস্য বজায় রাখতে রাখা হয়েছে
        'navbar',
        'header',
        'breaking-news',

        // Homepage-এর বিজ্ঞাপনের অবস্থান
        'homepage-top',
        'homepage-middle',
        'homepage-bottom',

        // News Article-এর বিজ্ঞাপনের অবস্থান
        'in-article',
        'article-bottom',

        // অন্যান্য বিজ্ঞাপনের অবস্থান
        'sidebar',
        'footer',
        'popup',
      ],
      default: 'header',
      required: true,
    },

    // বিজ্ঞাপন চালু বা বন্ধ
    isActive: {
      type: Boolean,
      default: true,
    },

    // বিজ্ঞাপন দেখানোর সময়সীমা
    startAt: {
      type: Date,
      default: null,
    },

    endAt: {
      type: Date,
      default: null,
    },

    // Animated বিজ্ঞাপনের লেখা
    headline: {
      type: String,
      trim: true,
      default: '',
    },

    description: {
      type: String,
      trim: true,
      default: '',
    },

    price: {
      type: String,
      trim: true,
      default: '',
    },

    offer: {
      type: String,
      trim: true,
      default: '',
    },

    contact: {
      type: String,
      trim: true,
      default: '',
    },

    // Animated বিজ্ঞাপনের ডিজাইন
    backgroundColor: {
      type: String,
      default: '#ffffff',
    },

    textColor: {
      type: String,
      default: '#111111',
    },

    animation: {
      type: String,
      enum: ['none', 'fade', 'slide', 'zoom'],
      default: 'fade',
    },

    durationSeconds: {
      type: Number,
      min: 3,
      max: 60,
      default: 10,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Advertisement', advertisementSchema);
