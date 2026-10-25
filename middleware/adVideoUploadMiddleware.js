const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDirectory = path.join(__dirname, '..', 'uploads', 'ads');

fs.mkdirSync(uploadDirectory, { recursive: true });

// অনুমোদিত ভিডিও ফরম্যাট
const allowedTypes = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, uploadDirectory);
  },

  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const uniqueName = `ad-video-${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${extension}`;

    callback(null, uniqueName);
  },
});

function fileFilter(req, file, callback) {
  const extension = path.extname(file.originalname).toLowerCase();

  const expectedMimeType = allowedTypes[extension];

  if (expectedMimeType && file.mimetype === expectedMimeType) {
    return callback(null, true);
  }

  return callback(new Error('শুধু MP4 ও WebM ভিডিও আপলোড করা যাবে।'));
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // সর্বোচ্চ ২০ MB
    files: 1,
  },
});

module.exports = upload;
