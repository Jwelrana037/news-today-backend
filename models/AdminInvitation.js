
const mongoose = require('mongoose');

// Admin Invitation Schema
const adminInvitationSchema = new mongoose.Schema(
  {
    // যে Email-এ Invitation পাঠানো হবে
    email: {
      type: String,
      required: [true, 'Email দিতে হবে'],
      lowercase: true,
      trim: true,
    },

    // মূল Token নয়, Token-এর Hash সংরক্ষণ করা হবে
    tokenHash: {
      type: String,
      required: [true, 'Token Hash দিতে হবে'],
      unique: true,
      select: false,
    },

    // Invitation-এর মেয়াদ শেষ হওয়ার সময়
    expiresAt: {
      type: Date,
      required: [true, 'Expiry Date দিতে হবে'],
    },

    // Invitation ব্যবহার করা হয়েছে কি না
    used: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Model Export
module.exports = mongoose.model(
  'AdminInvitation',
  adminInvitationSchema
);

