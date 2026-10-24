const express = require('express');

const router = express.Router();

const { loginAdmin } = require('../controllers/adminController');
const loginLimiter = require('../middleware/loginLimiter');

const {
  createAdvertisement,
  getAllAdvertisements,
  updateAdvertisement,
  deleteAdvertisement,
  toggleAdvertisement
} = require('../controllers/advertisementController')

const adUpload = require('../middleware/adUploadMiddleware');
const { protectAdmin } = require('../middleware/authMiddleware');


// Admin Login
router.post('/login', loginLimiter, loginAdmin);

module.exports = router;

// Admin API: সব বিজ্ঞাপন দেখা
router.get('/advertisements', protectAdmin, getAllAdvertisements);

// Admin API: নতুন বিজ্ঞাপন তৈরি ও ছবি আপলোড
router.post(
  '/advertisements',
  protectAdmin,
  adUpload.single('image'),
  createAdvertisement
);

// Admin API: বিজ্ঞাপন আপডেট
router.put(
  '/advertisements/:id',
  protectAdmin,
  adUpload.single('image'),
  updateAdvertisement
);

// Admin API: বিজ্ঞাপন চালু অথবা বন্ধ
router.patch(
  '/advertisements/:id/toggle',
  protectAdmin,
  toggleAdvertisement
);

// Admin API: বিজ্ঞাপন ডিলিট
router.delete(
  '/advertisements/:id',
  protectAdmin,
  deleteAdvertisement
);
