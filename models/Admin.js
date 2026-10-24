const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
  {
    // Admin-এর নাম
    name: {
      type: String,
      required: [true, 'Admin-এর নাম দিতে হবে'],
      trim: true,
      minlength: [2, 'নাম কমপক্ষে ২ অক্ষরের হতে হবে'],
      maxlength: [100, 'নাম সর্বোচ্চ ১০০ অক্ষরের হতে পারবে'],
    },

    // Admin-এর Email
    email: {
      type: String,
      required: [true, 'Email দিতে হবে'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [254, 'Email অনেক বড়'],
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'সঠিক Email Address দিতে হবে'],
    },

    // Password
    password: {
      type: String,
      required: [true, 'Password দিতে হবে'],
      select: false,
    },

    // Admin Role
    role: {
      type: String,
      enum: ['admin'],
      default: 'admin',
      immutable: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Admin', adminSchema);
