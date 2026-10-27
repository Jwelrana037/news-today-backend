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
  trackAdvertisementClick,
  trackAdvertisementImpression,
} = require('../controllers/advertisementController');

const {
  uploadImage,
  uploadVideo,
} = require('../middleware/adUploadMiddleware');

const { protectAdmin } = require('../middleware/authMiddleware');

// ========================================
// Public Advertisement Routes
// ========================================

// Navbar advertisements
router.get('/navbar', getActiveNavbarAdvertisement);

// Advertisements by placement
router.get('/position/:position', getActiveAdvertisementsByPosition);

// Track advertisement click
router.post('/:id/click', trackAdvertisementClick);

// Track advertisement impression
router.post('/:id/impression', trackAdvertisementImpression);

// ========================================
// Admin Advertisement Routes
// ========================================

// Get all advertisements
router.get('/', protectAdmin, getAllAdvertisements);

// Create image/banner/text/popup advertisement
router.post(
  '/',
  protectAdmin,
  uploadImage.single('image'),
  createAdvertisement
);

// Create video advertisement
router.post(
  '/video',
  protectAdmin,
  uploadVideo.single('video'),
  createAdvertisement
);

// Update advertisement
router.put(
  '/:id',
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

// Activate/deactivate advertisement
router.patch('/:id/toggle', protectAdmin, toggleAdvertisement);

// Delete advertisement
router.delete('/:id', protectAdmin, deleteAdvertisement);

module.exports = router;
