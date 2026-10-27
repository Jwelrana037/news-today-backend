const mongoose = require('mongoose');

const advertisementSchema = new mongoose.Schema(
  {
    // ========================================
    // 1. Advertisement Basic Information
    // ========================================

    title: {
      type: String,
      required: [true, 'বিজ্ঞাপনের নাম দিতে হবে'],
      trim: true,
      maxlength: [150, 'বিজ্ঞাপনের নাম সর্বোচ্চ ১৫০ অক্ষর হতে পারবে'],
    },

    // text, banner, video, popup
    adType: {
      type: String,
      enum: ['text', 'banner', 'video', 'popup'],
      default: 'banner',
      required: true,
    },

    // ========================================
    // 2. Advertisement Content
    // ========================================

    headline: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    // পুরোনো Advertisement-এর অতিরিক্ত তথ্য
    price: {
      type: String,
      trim: true,
      default: '',
    },
    advertiserEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      default: '',
      validate: {
        validator: function (value) {
          if (!value) return true;

          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        },
        message: 'সঠিক Email Address দিন',
      },
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

    // ========================================
    // 3. Image and Video
    // ========================================

    image: {
      type: String,
      trim: true,
      default: '',
    },

    video: {
      type: String,
      trim: true,
      default: '',
    },

    youtubeUrl: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2048,
    },

    // ========================================
    // 4. Target URL
    // ========================================

    targetUrl: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2048,
      validate: {
        validator: function (value) {
          if (!value) return true;

          try {
            const url = new URL(value);

            return url.protocol === 'http:' || url.protocol === 'https:';
          } catch {
            return false;
          }
        },
        message: 'সঠিক HTTP অথবা HTTPS Target URL দিন',
      },
    },

    // ========================================
    // 5. Advertisement Placement
    // ========================================

    placement: {
      type: String,
      enum: [
        'navbar',
        'header',
        'breaking-news',
        'homepage-top',
        'homepage-middle',
        'homepage-bottom',
        'in-article',
        'article-bottom',
        'sidebar',
        'footer',
        'popup',
        'sticky-bottom',
      ],
      default: 'header',
      required: true,
    },

    // Advertisement Size Preset
    sizePreset: {
      type: String,
      enum: [
        'auto',
        'leaderboard',
        'large-banner',
        'medium-rectangle',
        'square',
        'mobile-banner',
        'large-mobile-banner',
        'custom',
      ],
      default: 'leaderboard',
    },

    width: {
      type: Number,
      default: 728,
      min: 1,
      max: 3000,
    },

    height: {
      type: Number,
      default: 90,
      min: 1,
      max: 3000,
    },

    fitMode: {
      type: String,
      enum: ['cover', 'contain', 'fill'],
      default: 'contain',
    },

    // ========================================
    // 6. Animation Settings
    // ========================================

    animationType: {
      type: String,
      enum: [
        'none',
        'scroll-left',
        'scroll-right',
        'fade',
        'slide',
        'typewriter',
        'zoom',
        'bounce',
      ],
      default: 'none',
    },

    // Animation speed in seconds
    animationSpeed: {
      type: Number,
      min: 5,
      max: 60,
      default: 20,
    },

    // Advertisement display duration
    durationSeconds: {
      type: Number,
      min: 3,
      max: 60,
      default: 10,
    },

    // ========================================
    // 7. Advertisement Colors
    // ========================================

    textColor: {
      type: String,
      default: '#111111',
      match: [/^#[0-9a-fA-F]{6}$/, 'সঠিক Text Color দিন'],
    },

    backgroundColor: {
      type: String,
      default: '#ffffff',
      match: [/^#[0-9a-fA-F]{6}$/, 'সঠিক Background Color দিন'],
    },

    buttonText: {
      type: String,
      trim: true,
      maxlength: 50,
      default: 'বিস্তারিত দেখুন',
    },

    // ========================================
    // 8. Advertiser Information
    // ========================================

    advertiserName: {
      type: String,
      trim: true,
      maxlength: 150,
      default: '',
    },

    // ========================================
    // 9. Schedule
    // ========================================

    startAt: {
      type: Date,
      default: null,
    },

    endAt: {
      type: Date,
      default: null,
    },

    // ========================================
    // 10. Active / Inactive
    // ========================================

    isActive: {
      type: Boolean,
      default: false,
    },

    // ========================================
    // 11. Advertisement Tracking
    // ========================================

    clickCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    impressionCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },

  {
    timestamps: true,
  }
);

// ========================================
// 12. Date Validation
// ========================================

advertisementSchema.pre('validate', function () {
  if (this.startAt && this.endAt && this.endAt <= this.startAt) {
    this.invalidate('endAt', 'বিজ্ঞাপন শেষ হওয়ার সময় শুরুর সময়ের পরে হতে হবে');
  }
});

// ========================================
// 13. Database Index
// ========================================

advertisementSchema.index({
  placement: 1,
  isActive: 1,
  startAt: 1,
  endAt: 1,
});

// ========================================
// 14. Export Model
// ========================================

module.exports = mongoose.model('Advertisement', advertisementSchema);
