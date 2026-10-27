const express = require('express');

const router = express.Router();

// ========================================
// 1. Controllers
// ========================================

// Admin Authentication & Auto News Settings Controller
const {
  loginAdmin,
  getNewsSettings,
  updateNewsSettings,
} = require('../controllers/adminController');

// Admin Invitation Registration Controller
const {
  registerAdminWithInvitation,
} = require('../controllers/invitationController');

// Admin Profile Controller
const {
  getAdminProfile,
  updateAdminProfile,
} = require('../controllers/adminProfileController');

// Advertisement Controller
const {
  createAdvertisement,
  getAllAdvertisements,
  updateAdvertisement,
  deleteAdvertisement,
  toggleAdvertisement,
} = require('../controllers/advertisementController');

const {
  getNewsQueueStats,
  collectNewsManually,
} = require('../controllers/newsQueueController');

// ========================================
// 2. Middleware
// ========================================

const loginLimiter = require('../middleware/loginLimiter');

const {
  uploadImage,
  uploadVideo,
} = require('../middleware/adUploadMiddleware');

const { protectAdmin } = require('../middleware/authMiddleware');

// ========================================
// 3. Admin Authentication Routes
// ========================================

// Admin Login
// POST /api/admin/login
router.post('/login', loginLimiter, loginAdmin);

// Admin Registration using Invitation Token
// POST /api/admin/register-with-invitation
router.post(
  '/register-with-invitation',
  loginLimiter,
  registerAdminWithInvitation
);

// ========================================
// RSS Queue Statistics
// ========================================

// GET /api/admin/news-queue/stats
router.get('/news-queue/stats', protectAdmin, getNewsQueueStats);

// ========================================
// Manual RSS Collection
// ========================================

// POST /api/admin/news-queue/collect
router.post('/news-queue/collect', protectAdmin, collectNewsManually);

// বর্তমান Auto News Settings দেখা
// GET /api/admin/news-settings
router.get('/news-settings', protectAdmin, getNewsSettings);

// Auto News Settings পরিবর্তন
// PATCH /api/admin/news-settings
router.patch('/news-settings', protectAdmin, updateNewsSettings);

// ========================================
// 5. Admin Profile Routes
// ========================================

// Admin Profile দেখা
// GET /api/admin/profile
router.get('/profile', protectAdmin, getAdminProfile);

// Admin Profile Update
// PUT /api/admin/profile
router.put('/profile', protectAdmin, updateAdminProfile);

// ========================================
// 6. Advertisement Routes
// ========================================

// সব বিজ্ঞাপন দেখা
// GET /api/admin/advertisements
router.get('/advertisements', protectAdmin, getAllAdvertisements);

// নতুন Image Advertisement তৈরি
// POST /api/admin/advertisements
router.post(
  '/advertisements',
  protectAdmin,
  uploadImage.single('image'),
  createAdvertisement
);

// নতুন Video Advertisement তৈরি
// POST /api/admin/advertisements/video
router.post(
  '/advertisements/video',
  protectAdmin,
  uploadVideo.single('video'),
  createAdvertisement
);

// বিজ্ঞাপন আপডেট — Image অথবা Video
// PUT /api/admin/advertisements/:id
router.put(
  '/advertisements/:id',
  protectAdmin,
  (req, res, next) => {
    const uploadType = req.headers['x-ad-upload-type'];

    if (uploadType === 'video') {
      return uploadVideo.single('video')(req, res, next);
    }

    return uploadImage.single('image')(req, res, next);
  },
  updateAdvertisement
);

// বিজ্ঞাপন চালু অথবা বন্ধ
// PATCH /api/admin/advertisements/:id/toggle
router.patch('/advertisements/:id/toggle', protectAdmin, toggleAdvertisement);

// বিজ্ঞাপন ডিলিট
// DELETE /api/admin/advertisements/:id
router.delete('/advertisements/:id', protectAdmin, deleteAdvertisement);

// ========================================
// 7. Export Router
// ========================================

module.exports = router;
