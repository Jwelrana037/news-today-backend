const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Upload folder-এর সম্পূর্ণ path
const uploadDirectory = path.join(__dirname, '..', 'uploads', 'news');

// Folder না থাকলে তৈরি করা
fs.mkdirSync(uploadDirectory, { recursive: true });

// অনুমোদিত image extensions ও MIME types
const allowedTypes = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

// ফাইল কোথায় সংরক্ষণ হবে
const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, uploadDirectory);
  },

  filename: function (req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();

    const uniqueName = `news-${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${extension}`;

    callback(null, uniqueName);
  },
});

// ফাইলের ধরন যাচাই
function fileFilter(req, file, callback) {
  const extension = path.extname(file.originalname).toLowerCase();

  const expectedMimeType = allowedTypes[extension];

  if (expectedMimeType && file.mimetype === expectedMimeType) {
    return callback(null, true);
  }

  return callback(
    new Error('শুধু বৈধ JPEG, PNG, WEBP ও GIF ছবি Upload করা যাবে।')
  );
}

// Multer configuration
const upload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 5 * 1024 * 1024, // সর্বোচ্চ 5 MB
    files: 1,
    fields: 20,
    parts: 25,
  },
});

module.exports = upload;
