const express = require('express');

const router = express.Router();

const {
  createAdvertisement,
  getAllAdvertisements,
  getActiveNavbarAdvertisement,
  updateAdvertisement,
  deleteAdvertisement,
  toggleAdvertisement,
} = require('../controllers/advertisementController');

const adUpload = require('../middleware/adUploadMiddleware');
const { protectAdmin } = require('../middleware/authMiddleware');

// Public API: Navbar-এর সক্রিয় বিজ্ঞাপন
router.get('/navbar', getActiveNavbarAdvertisement);

// Admin API: সব বিজ্ঞাপন দেখা
router.get('/', protectAdmin, getAllAdvertisements);

// Admin API: নতুন বিজ্ঞাপন যোগ করা
router.post('/', protectAdmin, adUpload.single('image'), createAdvertisement);

// Admin API: বিজ্ঞাপন আপডেট করা
router.put('/:id', protectAdmin, adUpload.single('image'), updateAdvertisement);

// Admin API: বিজ্ঞাপন সক্রিয়/নিষ্ক্রিয় করা
router.patch('/:id/toggle', protectAdmin, toggleAdvertisement);

// Admin API: বিজ্ঞাপন মুছে ফেলা
router.delete('/:id', protectAdmin, deleteAdvertisement);

module.exports = router;
