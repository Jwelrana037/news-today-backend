const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// JWT Token তৈরি
function generateToken(admin) {
  return jwt.sign(
    {
      id: admin._id.toString(),
      role: admin.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '1d',
      algorithm: 'HS256',
    }
  );
}

// Admin Login
const loginAdmin = async (req, res) => {
  try {
    // 1. Server configuration যাচাই
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is missing.');

      return res.status(500).json({
        success: false,
        message: 'Server configuration error',
      });
    }

    // 2. Request থেকে Email ও Password নেওয়া
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

    // 3. Email দিয়ে Admin খোঁজা
    const admin = await Admin.findOne({
      email: email.trim().toLowerCase(),
    }).select('+password');

    // 4. Admin না থাকলে একই Error Message
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Email অথবা Password ভুল',
      });
    }

    // 5. Password যাচাই
    const isPasswordCorrect = await bcrypt.compare(password, admin.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Email অথবা Password ভুল',
      });
    }

    // 6. JWT Token তৈরি
    const token = generateToken(admin);

    // 7. সফল Response
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

module.exports = { loginAdmin };
