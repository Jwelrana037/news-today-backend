const mongoose = require('mongoose');

const newsQueueSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      required: true,
      trim: true,
    },

    sourceUrl: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    summary: {
      type: String,
      default: '',
      trim: true,
    },

    image: {
      type: String,
      default: '',
      trim: true,
    },

    sourcePublishedAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },

    attempts: {
      type: Number,
      default: 0,
    },

    nextAttemptAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    lastError: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

newsQueueSchema.index({ status: 1, nextAttemptAt: 1 });

module.exports = mongoose.model('NewsQueue', newsQueueSchema);
