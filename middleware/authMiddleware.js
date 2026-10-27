const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

exports.protectAdmin = async (req, res, next) => {
  try {
    // 1. JWT Secret আছে কি না পরীক্ষা
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is missing in environment variables.');

      return res.status(500).json({
        success: false,
        message: 'Server configuration error',
      });
    }

    // 2. Authorization Header সংগ্রহ
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Login করা প্রয়োজন',
      });
    }

    // 3. Token সংগ্রহ
    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token পাওয়া যায়নি',
      });
    }

    // 4. JWT যাচাই
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });

    // 5. Token-এর প্রয়োজনীয় তথ্য যাচাই
    if (
      !decoded.id ||
      decoded.role !== 'admin' ||
      !Number.isInteger(decoded.tokenVersion)
    ) {
      return res.status(401).json({
        success: false,
        message: 'Token অবৈধ। আবার Login করুন।',
      });
    }

    // 6. Database থেকে Admin এবং Token Version সংগ্রহ
    const admin = await Admin.findById(decoded.id).select(
      '+tokenVersion -password'
    );

    // 7. Admin আছে কি না পরীক্ষা
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'এই কাজের অনুমতি নেই',
      });
    }

    // 8. Token Version মিলিয়ে দেখা
    if ((admin.tokenVersion || 0) !== decoded.tokenVersion) {
      return res.status(401).json({
        success: false,
        message: 'আপনার Session বাতিল হয়েছে। আবার Login করুন।',
      });
    }

    // 9. পরবর্তী Route-এর জন্য Admin সংরক্ষণ
    req.admin = admin;

    // 10. পরবর্তী Middleware বা Controller চালানো
    return next();
  } catch (error) {
    if (
      error.name === 'JsonWebTokenError' ||
      error.name === 'TokenExpiredError' ||
      error.name === 'NotBeforeError'
    ) {
      return res.status(401).json({
        success: false,
        message: 'Token অবৈধ অথবা মেয়াদ শেষ হয়েছে',
      });
    }

    console.error('Admin Authentication Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Authentication প্রক্রিয়ায় সমস্যা হয়েছে',
    });
  }
};
