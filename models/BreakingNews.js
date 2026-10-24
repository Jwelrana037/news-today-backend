const mongoose = require('mongoose');

const breakingNewsSchema = new mongoose.Schema(
  {
    titleBn: {
      type: String,
      required: [true, 'বাংলা শিরোনাম দিতে হবে।'],
      trim: true,
      maxlength: [250, 'বাংলা শিরোনাম ২৫০ অক্ষরের বেশি হতে পারবে না।'],
    },

    titleEn: {
      type: String,
      required: [true, 'English title is required.'],
      trim: true,
      maxlength: [250, 'English title cannot exceed 250 characters.'],
    },

    link: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Link is too long.'],
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    priority: {
      type: Number,
      default: 0,
    },

    publishedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('BreakingNews', breakingNewsSchema);
