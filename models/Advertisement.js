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

    // বিজ্ঞাপনের ছবির URL
    image: {
      type: String,
      required: [true, 'বিজ্ঞাপনের ছবি দিতে হবে'],
      trim: true,
    },

    // ছবিতে ক্লিক করলে যে লিংক খুলবে
    targetUrl: {
      type: String,
      required: [true, 'বিজ্ঞাপনের লিংক দিতে হবে'],
      trim: true,
      maxlength: 2048,
    },

    // বিজ্ঞাপন চালু নাকি বন্ধ
    isActive: {
      type: Boolean,
      default: true,
    },

    // Navbar-এ বিজ্ঞাপন দেখানোর ক্রম
    position: {
      type: String,
      enum: ['navbar'],
      default: 'navbar',
    },

    // বিজ্ঞাপনের শুরু ও শেষের তারিখ (ঐচ্ছিক)
    startAt: {
      type: Date,
      default: null,
    },

    endAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Advertisement', advertisementSchema);
