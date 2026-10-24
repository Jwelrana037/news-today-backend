const express = require('express');

const router = express.Router();

const {
  getPublishedNews,
  getNewsById,
  getAllNewsForAdmin,
  getFeaturedNews,
  getNewsByCategory,

  searchNews,
  createNews,
  updateNews,
  deleteNews,
} = require('../controllers/newsController');

// uploads
const upload = require('../middleware/uploadMiddleware');
const { uploadNewsImage } = require('../controllers/newsController');


const { protectAdmin } = require('../middleware/authMiddleware');

// Admin API: নতুন সংবাদ তৈরি
router.post('/', protectAdmin, createNews);


// imageUploads

router.post(
  '/upload-image',
  protectAdmin,
  upload.single('image'),
  uploadNewsImage
);

// Admin API: সংবাদ সম্পাদনা
router.put('/:id', protectAdmin, updateNews);

// Admin API: সংবাদ মুছে ফেলা
router.delete('/:id', protectAdmin, deleteNews);

// Public API: প্রকাশিত সংবাদ
router.get('/', getPublishedNews);

router.get('/featured', getFeaturedNews);

// Admin API: সব সংবাদ দেখার জন্য
router.get('/admin/all', protectAdmin, getAllNewsForAdmin);

router.get('/search', searchNews);

router.get('/category/:category', getNewsByCategory);

// Public API: একটি নির্দিষ্ট সংবাদ
router.get('/:id', getNewsById);

module.exports = router;
