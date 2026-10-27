const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const Admin = require('../models/Admin');
const AdminInvitation = require('../models/AdminInvitation');

// ========================================
// Admin Registration Using Invitation Token
// ========================================

exports.registerAdminWithInvitation = async (req, res) => {
  try {
    // 1. Frontend থেকে তথ্য গ্রহণ
    const { name, email, password, token } = req.body || {};

    // 2. Required fields validation
    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      typeof token !== 'string' ||
      !name.trim() ||
      !email.trim() ||
      !password ||
      !token.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Name, Email, Password এবং Invitation Token দিতে হবে।',
      });
    }

    // 3. Normalize input
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedToken = token.trim();

    // 4. Name validation
    if (normalizedName.length < 2 || normalizedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'নাম ২ থেকে ১০০ অক্ষরের মধ্যে হতে হবে।',
      });
    }

    // 5. Email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (normalizedEmail.length > 254 || !emailPattern.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'সঠিক Email Address দিতে হবে।',
      });
    }

    // 6. Password validation
    if (password.length < 12 || password.length > 128) {
      return res.status(400).json({
        success: false,
        message: 'Password ১২ থেকে ১২৮ অক্ষরের মধ্যে হতে হবে।',
      });
    }

    // 7. Invitation token format validation
    if (!/^[a-f0-9]{64}$/i.test(normalizedToken)) {
      return res.status(400).json({
        success: false,
        message: 'Invitation Token সঠিক নয় বা মেয়াদ শেষ।',
      });
    }

    // 8. Token hash তৈরি
    const tokenHash = crypto
      .createHash('sha256')
      .update(normalizedToken, 'utf8')
      .digest('hex');

    const now = new Date();

    // 9. Valid invitation খোঁজা
    const invitation = await AdminInvitation.findOne({
      email: normalizedEmail,
      tokenHash,
      used: false,
      expiresAt: { $gt: now },
    }).select('+tokenHash');

    if (!invitation) {
      return res.status(400).json({
        success: false,
        message:
          'Invitation Token অবৈধ, ব্যবহৃত অথবা মেয়াদোত্তীর্ণ। নতুন Invitation Token নিন।',
      });
    }

    // 10. Email দিয়ে Admin আগে থেকেই আছে কি না যাচাই
    const existingAdmin = await Admin.findOne({
      email: normalizedEmail,
    });

    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: 'এই Email দিয়ে Admin Account আগে থেকেই আছে।',
      });
    }

    // 11. Invitation একবারের জন্য claim করা
    // Atomic update একই Token একাধিকবার ব্যবহার প্রতিরোধ করে
    const claimedInvitation = await AdminInvitation.findOneAndUpdate(
      {
        _id: invitation._id,
        email: normalizedEmail,
        tokenHash,
        used: false,
        expiresAt: { $gt: new Date() },
      },
      {
        $set: { used: true },
      },
      {
        new: true,
      }
    );

    if (!claimedInvitation) {
      return res.status(409).json({
        success: false,
        message: 'Invitation Token ইতিমধ্যে ব্যবহার করা হয়েছে। নতুন Token নিন।',
      });
    }

    // 12. Password hash করা
    const hashedPassword = await bcrypt.hash(password, 12);

    // 13. Admin Account তৈরি
    let admin;

    try {
      admin = await Admin.create({
        name: normalizedName,
        email: normalizedEmail,
        password: hashedPassword,
        role: 'admin',
        tokenVersion: 0,
      });
    } catch (error) {
      // Account তৈরির সময় ব্যর্থ হলে Invitation পুনরায়
      // ব্যবহারযোগ্য করা হবে, তবে Token-এর মেয়াদ থাকতে হবে।
      await AdminInvitation.updateOne(
        {
          _id: claimedInvitation._id,
          used: true,
          expiresAt: { $gt: new Date() },
        },
        {
          $set: { used: false },
        }
      );

      throw error;
    }

    // 14. Success response
    return res.status(201).json({
      success: true,
      message: 'Admin Account সফলভাবে তৈরি হয়েছে। এখন Login করুন।',
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    // Sensitive information যেমন Token/Password log করা হবে না
    console.error(
      'Admin Registration Error:',
      error.name || 'Error',
      error.code || ''
    );

    // Duplicate email বা unique index error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'এই Email দিয়ে Admin Account আগে থেকেই আছে।',
      });
    }

    // Mongoose validation error
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'প্রদত্ত তথ্য সঠিক নয়। আবার পরীক্ষা করুন।',
      });
    }

    // Unexpected server error
    return res.status(500).json({
      success: false,
      message:
        'Admin Account তৈরি করা যায়নি। Server Configuration পরীক্ষা করুন।',
    });
  }
};
