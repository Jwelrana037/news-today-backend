const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // ১৫ মিনিট

  limit: 10, // প্রতি IP থেকে সর্বোচ্চ ১০টি Request

  standardHeaders: 'draft-8',
  legacyHeaders: false,

  message: {
    success: false,
    message:
      'অনেকবার Login চেষ্টা করা হয়েছে। অনুগ্রহ করে ১৫ মিনিট পরে আবার চেষ্টা করুন।',
  },
});

module.exports = loginLimiter;
