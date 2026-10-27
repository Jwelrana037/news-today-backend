const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');

// ========================================
// 1. Admin Profile দেখা
// GET /api/admin/profile
// ========================================
exports.getAdminProfile = async (req, res) => {
  try {
    // protectAdmin middleware থেকে Admin পাওয়া যাবে
    const admin = await Admin.findById(req.admin._id).select(
      'name email role createdAt updatedAt'
    );

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin পাওয়া যায়নি',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Admin Profile পাওয়া গেছে',
      data: admin,
    });
  } catch (error) {
    console.error('Get Admin Profile Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Profile লোড করতে সমস্যা হয়েছে',
    });
  }
};

// ========================================
// 2. Admin Profile Update
// PUT /api/admin/profile
// ========================================
exports.updateAdminProfile = async (req, res) => {
  try {
    const { name, email, currentPassword, newPassword } = req.body;

    // Admin-এর ID JWT Middleware থেকে আসবে
    const admin = await Admin.findById(req.admin._id).select(
      '+password + tokenVersion'
    );

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin পাওয়া যায়নি',
      });
    }

    // পরিবর্তনের জন্য অন্তত একটি তথ্য দিতে হবে
    const wantsNameChange = name !== undefined;
    const wantsEmailChange = email !== undefined;
    const wantsPasswordChange = newPassword !== undefined;

    if (!wantsNameChange && !wantsEmailChange && !wantsPasswordChange) {
      return res.status(400).json({
        success: false,
        message: 'পরিবর্তন করার জন্য তথ্য দিন',
      });
    }

    // নাম যাচাই
    if (wantsNameChange) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'নাম কমপক্ষে ২ অক্ষরের হতে হবে',
        });
      }

      if (name.trim().length > 100) {
        return res.status(400).json({
          success: false,
          message: 'নাম সর্বোচ্চ ১০০ অক্ষরের হতে পারবে',
        });
      }
    }

    // Email যাচাই
    let normalizedEmail;

    if (wantsEmailChange) {
      if (
        typeof email !== 'string' ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      ) {
        return res.status(400).json({
          success: false,
          message: 'সঠিক Email Address দিন',
        });
      }

      normalizedEmail = email.trim().toLowerCase();

      // অন্য Admin এই Email ব্যবহার করছেন কি না
      const existingAdmin = await Admin.findOne({
        email: normalizedEmail,
        _id: { $ne: admin._id },
      });

      if (existingAdmin) {
        return res.status(409).json({
          success: false,
          message: 'এই Email অন্য Admin ব্যবহার করছেন',
        });
      }
    }

    // Password পরিবর্তনের সময় নতুন Password যাচাই
    if (wantsPasswordChange) {
      if (
        typeof newPassword !== 'string' ||
        newPassword.length < 12 ||
        newPassword.length > 128
      ) {
        return res.status(400).json({
          success: false,
          message: 'নতুন Password কমপক্ষে ১২ এবং সর্বোচ্চ ১২৮ অক্ষরের হতে হবে',
        });
      }

      if (
        currentPassword === undefined ||
        typeof currentPassword !== 'string'
      ) {
        return res.status(400).json({
          success: false,
          message: 'বর্তমান Password দিতে হবে',
        });
      }
    }

    // নাম, Email অথবা Password পরিবর্তনের আগে বর্তমান Password যাচাই
    if (typeof currentPassword !== 'string' || currentPassword.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'পরিবর্তন নিশ্চিত করতে বর্তমান Password দিন',
      });
    }

    const isPasswordCorrect = await bcrypt.compare(
      currentPassword,
      admin.password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'বর্তমান Password সঠিক নয়',
      });
    }

    // পরিবর্তনের তথ্য নির্ধারণ
    if (wantsNameChange) {
      admin.name = name.trim();
    }

    if (wantsEmailChange) {
      admin.email = normalizedEmail;
    }

    if (wantsPasswordChange) {
      const samePassword = await bcrypt.compare(newPassword, admin.password);

      if (samePassword) {
        return res.status(400).json({
          success: false,
          message: 'নতুন Password বর্তমান Password থেকে আলাদা হতে হবে',
        });
      }

      admin.password = await bcrypt.hash(newPassword, 12);
      admin.tokenVersion = (admin.tokenVersion || 0) + 1;
    }

    await admin.save();

    // Password hash কখনো Response-এ পাঠানো হবে না
    const safeAdmin = {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      updatedAt: admin.updatedAt,
    };

    return res.status(200).json({
      success: true,
      message: 'Admin Profile সফলভাবে আপডেট হয়েছে',
      data: safeAdmin,
      requireLoginAgain: wantsPasswordChange,
    });
  } catch (error) {
    // MongoDB unique email index-এর duplicate error
    if (error.code === 11000 && error.keyPattern?.email) {
      return res.status(409).json({
        success: false,
        message: 'এই Email ইতিমধ্যে ব্যবহৃত হচ্ছে',
      });
    }

    console.error('Update Admin Profile Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Profile আপডেট করতে সমস্যা হয়েছে',
    });
  }
};
