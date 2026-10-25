const express = require('express');
const router = express.Router();

const {
  createAdvertisement,
  getAllAdvertisements,
  getActiveNavbarAdvertisement,
  getActiveAdvertisementsByPosition,
  updateAdvertisement,
  deleteAdvertisement,
  toggleAdvertisement,
} = require('../controllers/advertisementController');

const adUpload = require('../middleware/adUploadMiddleware');
const adVideoUpload = require('../middleware/adVideoUploadMiddleware');
const { protectAdmin } = require('../middleware/authMiddleware');

// Public API: Navbar বিজ্ঞাপন
router.get('/navbar', getActiveNavbarAdvertisement);

// Public API: নির্দিষ্ট Placement-এর বিজ্ঞাপন
router.get('/position/:position', getActiveAdvertisementsByPosition);

// Admin API: সব বিজ্ঞাপন দেখা
router.get('/', protectAdmin, getAllAdvertisements);

// Admin API: ছবি দিয়ে বিজ্ঞাপন তৈরি
router.post('/', protectAdmin, adUpload.single('image'), createAdvertisement);

// Admin API: ভিডিও দিয়ে বিজ্ঞাপন তৈরি
router.post(
  '/video',
  protectAdmin,
  adVideoUpload.single('video'),
  createAdvertisement
);

// Admin API: বিজ্ঞাপন আপডেট
router.put(
  '/:id',
  protectAdmin,
  (req, res, next) => {
    const uploadType = req.headers['x-ad-upload-type'];

    if (uploadType === 'video') {
      return adVideoUpload.single('video')(req, res, next);
    }

    return adUpload.single('image')(req, res, next);
  },
  updateAdvertisement
);

// Admin API: বিজ্ঞাপন চালু/বন্ধ
router.patch('/:id/toggle', protectAdmin, toggleAdvertisement);

// Admin API: বিজ্ঞাপন ডিলিট
router.delete('/:id', protectAdmin, deleteAdvertisement);

module.exports = router;
