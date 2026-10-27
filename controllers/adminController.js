const Admin = require('../models/Admin');
const NewsSettings = require('../models/NewsSettings');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ========================================
// 1. JWT Token তৈরি
// ========================================

function generateToken(admin) {
  return jwt.sign(
    {
      id: admin._id.toString(),
      role: admin.role,
      tokenVersion: admin.tokenVersion || 0,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '1d',
      algorithm: 'HS256',
    }
  );
}

// ========================================
// 2. Admin Login
// POST /api/admin/login
// ========================================

const loginAdmin = async (req, res) => {
  try {
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is missing.');

      return res.status(500).json({
        success: false,
        message: 'Server configuration error',
      });
    }

    const { email, password } = req.body || {};

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: 'সঠিক Email এবং Password দিতে হবে',
      });
    }

    const admin = await Admin.findOne({
      email: email.trim().toLowerCase(),
    }).select('+password +tokenVersion');

    if (!admin || admin.role !== 'admin') {
      return res.status(401).json({
        success: false,
        message: 'Email অথবা Password ভুল',
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, admin.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Email অথবা Password ভুল',
      });
    }

    const token = generateToken(admin);

    return res.status(200).json({
      success: true,
      message: 'Admin Login সফল হয়েছে',
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error('Admin Login Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server-এ সমস্যা হয়েছে',
    });
  }
};

// ========================================
// 3. Auto News Settings পড়া
// GET /api/admin/news-settings
// ========================================

const getNewsSettings = async (req, res) => {
  try {
    let settings = await NewsSettings.findOne({
      key: 'autoNews',
    });

    // প্রথমবার Settings তৈরি করা
    if (!settings) {
      settings = await NewsSettings.findOneAndUpdate(
        { key: 'autoNews' },
        {
          $setOnInsert: {
            key: 'autoNews',
            enabled: false,
            mode: 'review',
            comillaEnabled: true,
            nationalEnabled: true,
            internationalEnabled: true,
          },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      );
    } else if (settings.comillaEnabled === undefined) {
      // পুরোনো Settings ডকুমেন্টে নতুন Field না থাকলে
      settings.comillaEnabled = true;
      await settings.save();
    }

    return res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Get News Settings Error:', error);

    return res.status(500).json({
      success: false,
      message: 'News Settings লোড করা যায়নি',
    });
  }
};

// ========================================
// 4. Auto News Settings পরিবর্তন
// PATCH /api/admin/news-settings
// ========================================

const updateNewsSettings = async (req, res) => {
  try {
    const {
      enabled,
      mode,
      comillaEnabled,
      nationalEnabled,
      internationalEnabled,
    } = req.body || {};

    const updates = {};

    // Auto News চালু / বন্ধ
    if (enabled !== undefined) {
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'enabled অবশ্যই true অথবা false হতে হবে',
        });
      }

      updates.enabled = enabled;
    }

    // Review / Auto Publish Mode
    if (mode !== undefined) {
      if (!['review', 'auto'].includes(mode)) {
        return res.status(400).json({
          success: false,
          message: "mode অবশ্যই 'review' অথবা 'auto' হতে হবে",
        });
      }

      updates.mode = mode;
    }

    // কুমিল্লার সংবাদ
    if (comillaEnabled !== undefined) {
      if (typeof comillaEnabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'comillaEnabled অবশ্যই boolean হতে হবে',
        });
      }

      updates.comillaEnabled = comillaEnabled;
    }

    // জাতীয় সংবাদ
    if (nationalEnabled !== undefined) {
      if (typeof nationalEnabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'nationalEnabled অবশ্যই boolean হতে হবে',
        });
      }

      updates.nationalEnabled = nationalEnabled;
    }

    // আন্তর্জাতিক সংবাদ
    if (internationalEnabled !== undefined) {
      if (typeof internationalEnabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'internationalEnabled অবশ্যই boolean হতে হবে',
        });
      }

      updates.internationalEnabled = internationalEnabled;
    }

    // কোনো বৈধ পরিবর্তন দেওয়া হয়নি
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'পরিবর্তন করার মতো কোনো বৈধ Setting দেওয়া হয়নি',
      });
    }

    // Settings তৈরি বা আপডেট
    const settings = await NewsSettings.findOneAndUpdate(
      { key: 'autoNews' },
      {
        $set: updates,
        $setOnInsert: {
          key: 'autoNews',
          comillaEnabled: true,
          nationalEnabled: true,
          internationalEnabled: true,
          enabled: false,
          mode: 'review',
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(200).json({
      success: true,
      message: 'News Settings সফলভাবে আপডেট হয়েছে',
      data: settings,
    });
  } catch (error) {
    console.error('Update News Settings Error:', error);

    return res.status(500).json({
      success: false,
      message: 'News Settings আপডেট করা যায়নি',
    });
  }
};

// ========================================
// Export
// ========================================

module.exports = {
  loginAdmin,
  getNewsSettings,
  updateNewsSettings,
};
