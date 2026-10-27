const express = require('express');

const router = express.Router();

// Controllers
const {
  getPublishedNews,
  getNewsById,
  getAllNewsForAdmin,
  getFeaturedNews,
  getNewsByCategory,
  getNewsByLocation,
  searchNews,
  createNews,
  updateNews,
  deleteNews,
  uploadNewsImage,
} = require('../controllers/newsController');

// Middleware
const upload = require('../middleware/uploadMiddleware');
const { protectAdmin } = require('../middleware/authMiddleware');

// ========================================
// PUBLIC API ROUTES
// ========================================

// Featured News
// GET /api/news/featured
console.log('getFeaturedNews:', typeof getFeaturedNews);

router.get('/featured', getFeaturedNews);

// Search News
// GET /api/news/search?q=বাংলাদেশ
router.get('/search', searchNews);

// Location-based News
// GET /api/news/location?division=চট্টগ্রাম
// GET /api/news/location?district=কুমিল্লা
// GET /api/news/location?upazila=দাউদকান্দি
router.get('/location', getNewsByLocation);

// Category-based News
// GET /api/news/category/national
// GET /api/news/category/sports
router.get('/category/:category', getNewsByCategory);

// All Published News
// GET /api/news?page=1&limit=10
router.get('/', getPublishedNews);

// Single Published News
// GET /api/news/:id
router.get('/:id', getNewsById);

// ========================================
// ADMIN API ROUTES
// ========================================

// Get All News for Admin
// GET /api/news/admin/all
router.get('/admin/all', protectAdmin, getAllNewsForAdmin);

// Create News
// POST /api/news
router.post('/', protectAdmin, createNews);

// Upload News Image
// POST /api/news/upload-image
router.post(
  '/upload-image',
  protectAdmin,
  upload.single('image'),
  uploadNewsImage
);

// Update News
// PUT /api/news/:id
router.put('/:id', protectAdmin, updateNews);

// Delete News
// DELETE /api/news/:id
router.delete('/:id', protectAdmin, deleteNews);

module.exports = router;
