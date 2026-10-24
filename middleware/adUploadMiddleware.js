const multer = require('multer');
const path = require('path');
const fs = require('fs');

// বিজ্ঞাপনের ছবি রাখার ফোল্ডার
const uploadDirectory = path.join(__dirname, '..', 'uploads', 'ads');

// ফোল্ডার না থাকলে তৈরি করা
fs.mkdirSync(uploadDirectory, { recursive: true });

// অনুমোদিত ছবির ফরম্যাট
const allowedTypes = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

// ছবি সংরক্ষণের ব্যবস্থা
const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, uploadDirectory);
  },

  filename: function (req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();

    const uniqueName = `ad-${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${extension}`;

    callback(null, uniqueName);
  },
});

// ছবির ফরম্যাট যাচাই
function fileFilter(req, file, callback) {
  const extension = path.extname(file.originalname).toLowerCase();
  const expectedMimeType = allowedTypes[extension];

  if (expectedMimeType && file.mimetype === expectedMimeType) {
    return callback(null, true);
  }

  return callback(new Error('শুধু JPEG, PNG, WEBP ও GIF ছবি Upload করা যাবে।'));
}

// Multer configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

module.exports = upload;
