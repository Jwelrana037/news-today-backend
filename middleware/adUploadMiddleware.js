const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ========================================
// 1. Advertisement Upload Directory
// ========================================

const uploadDirectory = path.join(__dirname, '..', 'uploads', 'ads');

// ফোল্ডার না থাকলে তৈরি হবে
fs.mkdirSync(uploadDirectory, { recursive: true });

// ========================================
// 2. Allowed File Types
// ========================================

const allowedImageTypes = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

const allowedVideoTypes = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

// ========================================
// 3. File Storage
// ========================================

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

// ========================================
// 4. File Validation
// ========================================

function fileFilter(req, file, callback) {
  const extension = path.extname(file.originalname).toLowerCase();

  const allowedTypes = {
    ...allowedImageTypes,
    ...allowedVideoTypes,
  };

  const expectedMimeType = allowedTypes[extension];

  // Extension ও MIME type দুটোই যাচাই
  if (expectedMimeType && file.mimetype === expectedMimeType) {
    return callback(null, true);
  }

  return callback(
    new Error(
      'শুধু JPG, JPEG, PNG, WEBP, GIF, MP4 ও WEBM ফাইল Upload করা যাবে।'
    )
  );
}

// ========================================
// 5. File Size Limit
// ========================================

function fileSizeLimit(req, file) {
  const extension = path.extname(file.originalname).toLowerCase();

  const isVideo = Object.prototype.hasOwnProperty.call(
    allowedVideoTypes,
    extension
  );

  return isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
}

// ========================================
// 6. Multer Configuration
// ========================================

const upload = multer({
  storage,

  fileFilter,

  // Multer-এর fileSize limit একটি request-এর
  // সব ফাইলের জন্য প্রযোজ্য।
  // তাই video ও image-এর আলাদা limit রাখতে
  // নিচে পৃথক upload middleware ব্যবহার করা হবে।
  limits: {
    files: 1,
  },
});

// ========================================
// 7. Export Middleware
// ========================================

// Image upload: সর্বোচ্চ 5 MB
const uploadImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

// Video upload: সর্বোচ্চ 50 MB
const uploadVideo = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 1,
  },
});

module.exports = {
  upload,
  uploadImage,
  uploadVideo,
};
