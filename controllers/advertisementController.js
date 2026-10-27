const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const Advertisement = require('../models/Advertisement');

// ==================================================
// 1. CONFIGURATION
// ==================================================

const UPLOAD_DIR = path.resolve(__dirname, '..', 'uploads', 'ads');

const VALID_AD_TYPES = ['text', 'banner', 'video', 'popup'];

const VALID_PLACEMENTS = [
  'navbar',
  'header',
  'breaking-news',
  'homepage-top',
  'homepage-middle',
  'homepage-bottom',
  'in-article',
  'article-bottom',
  'sidebar',
  'footer',
  'popup',
  'sticky-bottom',
];

const VALID_ANIMATIONS = [
  'none',
  'scroll-left',
  'scroll-right',
  'fade',
  'slide',
  'typewriter',
  'zoom',
  'bounce',
];

const VALID_VIDEO_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
];

const VALID_SIZE_PRESETS = [
  'auto',
  'leaderboard',
  'large-banner',
  'medium-rectangle',
  'square',
  'mobile-banner',
  'large-mobile-banner',
  'custom',
];

const VALID_FIT_MODES = ['cover', 'contain', 'fill'];

// Standard advertisement dimensions.
// Auto mode uses a responsive layout in the frontend.
const SIZE_PRESETS = {
  auto: {
    width: 728,
    height: 90,
  },

  leaderboard: {
    width: 728,
    height: 90,
  },

  'large-banner': {
    width: 970,
    height: 250,
  },

  'medium-rectangle': {
    width: 300,
    height: 250,
  },

  square: {
    width: 300,
    height: 300,
  },

  'mobile-banner': {
    width: 320,
    height: 50,
  },

  'large-mobile-banner': {
    width: 320,
    height: 100,
  },

  custom: {
    width: 728,
    height: 90,
  },
};

// ==================================================
// 2. HELPER: SEND ERROR RESPONSE
// ==================================================

const sendError = (res, statusCode, message) => {
  return res.status(statusCode).json({
    success: false,
    message,
  });
};

// ==================================================
// 3. HELPER: VALIDATE MONGODB ID
// ==================================================

const isValidId = (id) => {
  return (
    typeof id === 'string' &&
    mongoose.Types.ObjectId.isValid(id) &&
    String(new mongoose.Types.ObjectId(id)) === id.toLowerCase()
  );
};

// ==================================================
// 4. HELPER: PARSE BOOLEAN
// ==================================================

const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  const normalized = String(value).trim().toLowerCase();

  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return defaultValue;
};

// ==================================================
// 5. HELPER: VALIDATE TARGET URL
// ==================================================

const validateTargetUrl = (url) => {
  if (url === undefined || url === null || String(url).trim() === '') {
    return {
      valid: true,
      value: '',
    };
  }

  try {
    const parsedUrl = new URL(String(url).trim());

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return {
        valid: false,
        message: 'Target URL must use HTTP or HTTPS.',
      };
    }

    if (!parsedUrl.hostname) {
      return {
        valid: false,
        message: 'Please provide a valid target URL.',
      };
    }

    return {
      valid: true,
      value: parsedUrl.toString(),
    };
  } catch {
    return {
      valid: false,
      message: 'Please provide a valid target URL.',
    };
  }
};

// ==================================================
// 6. HELPER: VALIDATE YOUTUBE URL
// ==================================================

const validateYouTubeUrl = (url) => {
  if (url === undefined || url === null || String(url).trim() === '') {
    return {
      valid: true,
      value: '',
    };
  }

  try {
    const parsedUrl = new URL(String(url).trim());

    if (
      !['http:', 'https:'].includes(parsedUrl.protocol) ||
      !VALID_VIDEO_HOSTS.includes(parsedUrl.hostname.toLowerCase())
    ) {
      return {
        valid: false,
        message: 'Please provide a valid YouTube URL.',
      };
    }

    return {
      valid: true,
      value: parsedUrl.toString(),
    };
  } catch {
    return {
      valid: false,
      message: 'Please provide a valid YouTube URL.',
    };
  }
};

// ==================================================
// 7. HELPER: VALIDATE ADVERTISEMENT DATES
// ==================================================

const validateDates = (startAt, endAt) => {
  let startDate = null;
  let endDate = null;

  if (startAt !== undefined && startAt !== null && startAt !== '') {
    startDate = new Date(startAt);

    if (Number.isNaN(startDate.getTime())) {
      return {
        valid: false,
        message: 'Invalid advertisement start date.',
      };
    }
  }

  if (endAt !== undefined && endAt !== null && endAt !== '') {
    endDate = new Date(endAt);

    if (Number.isNaN(endDate.getTime())) {
      return {
        valid: false,
        message: 'Invalid advertisement end date.',
      };
    }
  }

  if (startDate && endDate && endDate <= startDate) {
    return {
      valid: false,
      message: 'End date must be later than start date.',
    };
  }

  return {
    valid: true,
    startAt: startDate,
    endAt: endDate,
  };
};

// ==================================================
// 8. HELPER: ACTIVE ADVERTISEMENT DATE FILTER
// ==================================================

const getActiveDateFilter = (now = new Date()) => {
  return {
    $and: [
      {
        $or: [
          { startAt: null },
          { startAt: { $exists: false } },
          { startAt: { $lte: now } },
        ],
      },
      {
        $or: [
          { endAt: null },
          { endAt: { $exists: false } },
          { endAt: { $gte: now } },
        ],
      },
    ],
  };
};

// ==================================================
// 9. HELPER: CHECK CURRENTLY ACTIVE ADVERTISEMENT
// ==================================================

const isAdvertisementCurrentlyActive = (advertisement) => {
  const now = new Date();

  if (!advertisement || !advertisement.isActive) {
    return false;
  }

  if (advertisement.startAt && new Date(advertisement.startAt) > now) {
    return false;
  }

  if (advertisement.endAt && new Date(advertisement.endAt) < now) {
    return false;
  }

  return true;
};

// ==================================================
// 10. HELPER: DELETE UPLOADED ADVERTISEMENT FILE
// ==================================================

const deleteAdFile = (fileUrl) => {
  if (!fileUrl || typeof fileUrl !== 'string') {
    return;
  }

  // Only accept files stored in our advertisement folder.
  const filename = path.basename(fileUrl);

  const allowedFilename =
    /^ad-(?:video-)?[\w-]+\.(jpg|jpeg|png|webp|gif|mp4|webm)$/i;

  if (!allowedFilename.test(filename)) {
    return;
  }

  const resolvedUploadDir = path.resolve(UPLOAD_DIR);
  const filePath = path.resolve(resolvedUploadDir, filename);

  // Prevent deletion outside the advertisement folder.
  if (path.dirname(filePath) !== resolvedUploadDir) {
    return;
  }

  fs.unlink(filePath, (error) => {
    if (error && error.code !== 'ENOENT') {
      console.error('Advertisement file deletion failed:', error.message);
    }
  });
};

// ==================================================
// 11. HELPER: GET ALLOWED FIELDS
// ==================================================

const getAllowedFields = (body = {}) => {
  const allowedFields = [
    'title',
    'adType',
    'headline',
    'description',
    'price',
    'offer',
    'contact',
    'youtubeUrl',
    'targetUrl',
    'placement',
    'animationType',
    'animationSpeed',
    'durationSeconds',
    'textColor',
    'backgroundColor',
    'buttonText',
    'advertiserName',
    'startAt',
    'endAt',
    'isActive',
    'sizePreset',
    'width',
    'height',
    'fitMode',
  ];

  const data = {};

  allowedFields.forEach((field) => {
    if (body[field] !== undefined) {
      data[field] = body[field];
    }
  });

  // Backward compatibility:
  // image -> banner
  // animated -> text
  if (data.adType === undefined && body.type !== undefined) {
    const oldTypeMap = {
      image: 'banner',
      animated: 'text',
      video: 'video',
      text: 'text',
      banner: 'banner',
      popup: 'popup',
    };

    data.adType = oldTypeMap[String(body.type).toLowerCase()] || body.type;
  }

  // Old position -> placement.
  if (data.placement === undefined && body.position !== undefined) {
    data.placement = body.position;
  }

  // Old animation -> animationType.
  if (data.animationType === undefined && body.animation !== undefined) {
    data.animationType = body.animation;
  }

  // Normalize string values.
  if (typeof data.adType === 'string') {
    data.adType = data.adType.trim().toLowerCase();
  }

  if (typeof data.placement === 'string') {
    data.placement = data.placement.trim().toLowerCase();
  }

  if (typeof data.animationType === 'string') {
    data.animationType = data.animationType.trim().toLowerCase();
  }

  if (typeof data.sizePreset === 'string') {
    data.sizePreset = data.sizePreset.trim().toLowerCase();
  }

  if (typeof data.fitMode === 'string') {
    data.fitMode = data.fitMode.trim().toLowerCase();
  }

  return data;
};

// ==================================================
// 12. HELPER: APPLY SIZE PRESET
// ==================================================

const applyAdvertisementSize = (data, existingAdvertisement = null) => {
  const sizePreset =
    data.sizePreset || existingAdvertisement?.sizePreset || 'leaderboard';

  // Validate the preset before applying dimensions.
  if (!VALID_SIZE_PRESETS.includes(sizePreset)) {
    return 'Invalid advertisement size preset.';
  }

  data.sizePreset = sizePreset;

  // Custom size preserves explicitly supplied dimensions.
  if (sizePreset === 'custom') {
    if (data.width === undefined && existingAdvertisement) {
      data.width = existingAdvertisement.width;
    }

    if (data.height === undefined && existingAdvertisement) {
      data.height = existingAdvertisement.height;
    }

    if (data.width === undefined) {
      data.width = SIZE_PRESETS.custom.width;
    }

    if (data.height === undefined) {
      data.height = SIZE_PRESETS.custom.height;
    }

    return null;
  }

  const presetDimensions = SIZE_PRESETS[sizePreset];

  // Only override dimensions when:
  // 1. Creating a new advertisement, or
  // 2. The preset has changed, or
  // 3. Dimensions were explicitly supplied.
  const presetChanged =
    !existingAdvertisement ||
    (data.sizePreset !== undefined &&
      data.sizePreset !== existingAdvertisement.sizePreset);

  if (presetChanged) {
    if (data.width === undefined) {
      data.width = presetDimensions.width;
    }

    if (data.height === undefined) {
      data.height = presetDimensions.height;
    }
  }

  return null;
};

// ==================================================
// 13. HELPER: VALIDATE ADVERTISEMENT SIZE
// ==================================================

const validateAdvertisementSize = (data) => {
  if (
    data.sizePreset !== undefined &&
    !VALID_SIZE_PRESETS.includes(data.sizePreset)
  ) {
    return 'Invalid advertisement size preset.';
  }

  if (data.fitMode !== undefined && !VALID_FIT_MODES.includes(data.fitMode)) {
    return 'Invalid advertisement fit mode.';
  }

  for (const field of ['width', 'height']) {
    if (data[field] !== undefined) {
      // Empty string should not silently become zero.
      if (data[field] === '' || data[field] === null) {
        return `${field} must be an integer between 1 and 3000.`;
      }

      const value = Number(data[field]);

      if (!Number.isInteger(value) || value < 1 || value > 3000) {
        return `${field} must be an integer between 1 and 3000.`;
      }

      data[field] = value;
    }
  }

  return null;
};

// ==================================================
// 14. HELPER: VALIDATE ADVERTISEMENT FIELDS
// ==================================================

const validateAdvertisementFields = (data) => {
  // Size validation must actually be called.
  const sizeError = validateAdvertisementSize(data);

  if (sizeError) {
    return sizeError;
  }

  // Advertisement type.
  if (data.adType !== undefined && !VALID_AD_TYPES.includes(data.adType)) {
    return 'Invalid advertisement type.';
  }

  // Advertisement placement.
  if (
    data.placement !== undefined &&
    !VALID_PLACEMENTS.includes(data.placement)
  ) {
    return 'Invalid advertisement placement.';
  }

  // Animation.
  if (
    data.animationType !== undefined &&
    !VALID_ANIMATIONS.includes(data.animationType)
  ) {
    return 'Invalid animation type.';
  }

  // Animation speed.
  if (data.animationSpeed !== undefined) {
    if (data.animationSpeed === '') {
      return 'Animation speed must be between 5 and 60.';
    }

    const speed = Number(data.animationSpeed);

    if (!Number.isFinite(speed) || speed < 5 || speed > 60) {
      return 'Animation speed must be between 5 and 60.';
    }

    data.animationSpeed = speed;
  }

  // Duration.
  if (data.durationSeconds !== undefined) {
    if (data.durationSeconds === '') {
      return 'Duration must be between 3 and 60 seconds.';
    }

    const duration = Number(data.durationSeconds);

    if (!Number.isFinite(duration) || duration < 3 || duration > 60) {
      return 'Duration must be between 3 and 60 seconds.';
    }

    data.durationSeconds = duration;
  }

  // Price.
  if (data.price !== undefined && data.price !== '') {
    const price = Number(data.price);

    if (!Number.isFinite(price) || price < 0) {
      return 'Price must be a valid non-negative number.';
    }

    data.price = price;
  }

  // Active status.
  if (data.isActive !== undefined) {
    data.isActive = parseBoolean(data.isActive);
  }

  return null;
};

// ==================================================
// 15. HELPER: VALIDATE ADVERTISEMENT CONTENT
// ==================================================

const validateAdvertisementContent = (data, existingAdvertisement = null) => {
  const adType = data.adType || existingAdvertisement?.adType || 'banner';

  const image =
    data.image !== undefined ? data.image : existingAdvertisement?.image;

  const video =
    data.video !== undefined ? data.video : existingAdvertisement?.video;

  const youtubeUrl =
    data.youtubeUrl !== undefined
      ? data.youtubeUrl
      : existingAdvertisement?.youtubeUrl;

  const headline =
    data.headline !== undefined
      ? data.headline
      : existingAdvertisement?.headline;

  const description =
    data.description !== undefined
      ? data.description
      : existingAdvertisement?.description;

  if (adType === 'banner' && !image) {
    return 'Please upload an image for a banner advertisement.';
  }

  if (adType === 'video' && !video && !youtubeUrl) {
    return 'Upload a video or provide a YouTube URL.';
  }

  if (
    adType === 'text' &&
    !String(headline || '').trim() &&
    !String(description || '').trim()
  ) {
    return 'Please provide a headline or description.';
  }

  return null;
};

// ==================================================
// 16. HELPER: VALIDATE UPLOADED FILE
// ==================================================

const getUploadedFileUrl = (req) => {
  if (!req.file) {
    return null;
  }

  return `/uploads/ads/${req.file.filename}`;
};

// ==================================================
// 17. CREATE ADVERTISEMENT
// POST /api/advertisements
// POST /api/advertisements/video
// ==================================================

exports.createAdvertisement = async (req, res) => {
  try {
    const data = getAllowedFields(req.body);

    // Required title.
    if (!data.title || !String(data.title).trim()) {
      if (req.file) {
        deleteAdFile(getUploadedFileUrl(req));
      }

      return sendError(res, 400, 'Advertisement title is required.');
    }

    data.title = String(data.title).trim();

    // Determine advertisement type.
    data.adType =
      data.adType || (req.file?.fieldname === 'video' ? 'video' : 'banner');

    data.placement = data.placement || 'homepage-top';

    data.animationType = data.animationType || 'none';

    data.sizePreset = data.sizePreset || 'leaderboard';

    data.fitMode = data.fitMode || 'contain';

    // Apply preset dimensions.
    const sizeError = applyAdvertisementSize(data);

    if (sizeError) {
      if (req.file) {
        deleteAdFile(getUploadedFileUrl(req));
      }

      return sendError(res, 400, sizeError);
    }

    // Validate fields.
    const fieldError = validateAdvertisementFields(data);

    if (fieldError) {
      if (req.file) {
        deleteAdFile(getUploadedFileUrl(req));
      }

      return sendError(res, 400, fieldError);
    }

    // Validate target URL.
    const targetUrlResult = validateTargetUrl(data.targetUrl);

    if (!targetUrlResult.valid) {
      if (req.file) {
        deleteAdFile(getUploadedFileUrl(req));
      }

      return sendError(res, 400, targetUrlResult.message);
    }

    data.targetUrl = targetUrlResult.value;

    // Validate YouTube URL.
    const youtubeResult = validateYouTubeUrl(data.youtubeUrl);

    if (!youtubeResult.valid) {
      if (req.file) {
        deleteAdFile(getUploadedFileUrl(req));
      }

      return sendError(res, 400, youtubeResult.message);
    }

    data.youtubeUrl = youtubeResult.value;

    // Validate schedule.
    const dateResult = validateDates(data.startAt, data.endAt);

    if (!dateResult.valid) {
      if (req.file) {
        deleteAdFile(getUploadedFileUrl(req));
      }

      return sendError(res, 400, dateResult.message);
    }

    data.startAt = dateResult.startAt;
    data.endAt = dateResult.endAt;

    // Process uploaded image/video.
    if (req.file) {
      const fileUrl = getUploadedFileUrl(req);

      if (req.file.fieldname === 'video') {
        data.video = fileUrl;
      } else {
        data.image = fileUrl;
      }
    }

    // Validate required content.
    const contentError = validateAdvertisementContent(data);

    if (contentError) {
      if (req.file) {
        deleteAdFile(getUploadedFileUrl(req));
      }

      return sendError(res, 400, contentError);
    }

    // New advertisements are inactive by default.
    data.isActive = parseBoolean(req.body.isActive, false);

    const advertisement = await Advertisement.create(data);

    return res.status(201).json({
      success: true,
      message: 'Advertisement created successfully.',
      data: advertisement,
    });
  } catch (error) {
    console.error('Create advertisement error:', error);

    if (req.file) {
      deleteAdFile(getUploadedFileUrl(req));
    }

    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return sendError(res, 400, error.message);
    }

    return sendError(res, 500, 'Failed to create advertisement.');
  }
};

// ==================================================
// 18. GET ALL ADVERTISEMENTS
// GET /api/advertisements
// ==================================================

exports.getAllAdvertisements = async (req, res) => {
  try {
    const advertisements = await Advertisement.find().sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: advertisements.length,
      data: advertisements,
    });
  } catch (error) {
    console.error('Get all advertisements error:', error);

    return sendError(res, 500, 'Failed to fetch advertisements.');
  }
};

// ==================================================
// 19. GET ACTIVE ADVERTISEMENTS BY PLACEMENT
// GET /api/advertisements/position/:position
// ==================================================

exports.getActiveAdvertisementsByPosition = async (req, res) => {
  try {
    const { position } = req.params;

    if (!VALID_PLACEMENTS.includes(position)) {
      return sendError(res, 400, 'Invalid advertisement placement.');
    }

    const now = new Date();

    const advertisements = await Advertisement.find({
      isActive: true,
      placement: position,
      ...getActiveDateFilter(now),
    }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      placement: position,
      count: advertisements.length,
      data: advertisements,
    });
  } catch (error) {
    console.error('Get advertisements by placement error:', error);

    return sendError(res, 500, 'Failed to fetch advertisements.');
  }
};

// ==================================================
// 20. GET ACTIVE NAVBAR ADVERTISEMENT
// GET /api/advertisements/navbar
// ==================================================

exports.getActiveNavbarAdvertisement = async (req, res) => {
  try {
    const now = new Date();

    const advertisements = await Advertisement.find({
      isActive: true,
      placement: 'navbar',
      ...getActiveDateFilter(now),
    }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: advertisements.length,
      data: advertisements,
    });
  } catch (error) {
    console.error('Get navbar advertisements error:', error);

    return sendError(res, 500, 'Failed to fetch navbar advertisements.');
  }
};

// ==================================================
// 21. UPDATE ADVERTISEMENT
// PUT /api/advertisements/:id
// ==================================================

exports.updateAdvertisement = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      if (req.file) {
        deleteAdFile(getUploadedFileUrl(req));
      }

      return sendError(res, 400, 'Invalid advertisement ID.');
    }

    const advertisement = await Advertisement.findById(id);

    if (!advertisement) {
      if (req.file) {
        deleteAdFile(getUploadedFileUrl(req));
      }

      return sendError(res, 404, 'Advertisement not found.');
    }

    const data = getAllowedFields(req.body);

    // Validate title if supplied.
    if (data.title !== undefined) {
      if (!String(data.title).trim()) {
        if (req.file) {
          deleteAdFile(getUploadedFileUrl(req));
        }

        return sendError(res, 400, 'Advertisement title cannot be empty.');
      }

      data.title = String(data.title).trim();
    }

    // Apply dimensions only when appropriate.
    const sizeError = applyAdvertisementSize(data, advertisement);

    if (sizeError) {
      if (req.file) {
        deleteAdFile(getUploadedFileUrl(req));
      }

      return sendError(res, 400, sizeError);
    }

    // Validate fields.
    const fieldError = validateAdvertisementFields(data);

    if (fieldError) {
      if (req.file) {
        deleteAdFile(getUploadedFileUrl(req));
      }

      return sendError(res, 400, fieldError);
    }

    // Validate target URL only when supplied.
    if (data.targetUrl !== undefined) {
      const targetUrlResult = validateTargetUrl(data.targetUrl);

      if (!targetUrlResult.valid) {
        if (req.file) {
          deleteAdFile(getUploadedFileUrl(req));
        }

        return sendError(res, 400, targetUrlResult.message);
      }

      data.targetUrl = targetUrlResult.value;
    }

    // Validate YouTube URL only when supplied.
    if (data.youtubeUrl !== undefined) {
      const youtubeResult = validateYouTubeUrl(data.youtubeUrl);

      if (!youtubeResult.valid) {
        if (req.file) {
          deleteAdFile(getUploadedFileUrl(req));
        }

        return sendError(res, 400, youtubeResult.message);
      }

      data.youtubeUrl = youtubeResult.value;
    }

    // Validate dates against the resulting document.
    const nextStartAt =
      data.startAt !== undefined ? data.startAt : advertisement.startAt;

    const nextEndAt =
      data.endAt !== undefined ? data.endAt : advertisement.endAt;

    const dateResult = validateDates(nextStartAt, nextEndAt);

    if (!dateResult.valid) {
      if (req.file) {
        deleteAdFile(getUploadedFileUrl(req));
      }

      return sendError(res, 400, dateResult.message);
    }

    if (data.startAt !== undefined) {
      data.startAt = dateResult.startAt;
    }

    if (data.endAt !== undefined) {
      data.endAt = dateResult.endAt;
    }

    // Preserve old files for cleanup after successful save.
    const oldImage = advertisement.image;
    const oldVideo = advertisement.video;

    // Process new upload.
    if (req.file) {
      const uploadType = req.headers['x-ad-upload-type'];

      if (uploadType === 'video' || req.file.fieldname === 'video') {
        data.video = getUploadedFileUrl(req);
      } else {
        data.image = getUploadedFileUrl(req);
      }
    }

    // Build resulting data for content validation.
    const resultingData = {
      adType: data.adType !== undefined ? data.adType : advertisement.adType,

      image: data.image !== undefined ? data.image : advertisement.image,

      video: data.video !== undefined ? data.video : advertisement.video,

      youtubeUrl:
        data.youtubeUrl !== undefined
          ? data.youtubeUrl
          : advertisement.youtubeUrl,

      headline:
        data.headline !== undefined ? data.headline : advertisement.headline,

      description:
        data.description !== undefined
          ? data.description
          : advertisement.description,
    };

    const contentError = validateAdvertisementContent(
      resultingData,
      advertisement
    );

    if (contentError) {
      if (req.file) {
        deleteAdFile(getUploadedFileUrl(req));
      }

      return sendError(res, 400, contentError);
    }

    // Update document.
    Object.assign(advertisement, data);

    await advertisement.save();

    // Delete old files only after a successful save.
    if (advertisement.image && oldImage && advertisement.image !== oldImage) {
      deleteAdFile(oldImage);
    }

    if (advertisement.video && oldVideo && advertisement.video !== oldVideo) {
      deleteAdFile(oldVideo);
    }

    return res.status(200).json({
      success: true,
      message: 'Advertisement updated successfully.',
      data: advertisement,
    });
  } catch (error) {
    console.error('Update advertisement error:', error);

    if (req.file) {
      deleteAdFile(getUploadedFileUrl(req));
    }

    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return sendError(res, 400, error.message);
    }

    return sendError(res, 500, 'Failed to update advertisement.');
  }
};

// ==================================================
// 22. TOGGLE ADVERTISEMENT ACTIVE STATUS
// PATCH /api/advertisements/:id/toggle
// ==================================================

exports.toggleAdvertisement = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return sendError(res, 400, 'Invalid advertisement ID.');
    }

    const advertisement = await Advertisement.findById(id);

    if (!advertisement) {
      return sendError(res, 404, 'Advertisement not found.');
    }

    advertisement.isActive = !advertisement.isActive;

    await advertisement.save();

    return res.status(200).json({
      success: true,

      message: advertisement.isActive
        ? 'Advertisement activated successfully.'
        : 'Advertisement deactivated successfully.',

      data: advertisement,
    });
  } catch (error) {
    console.error('Toggle advertisement error:', error);

    return sendError(res, 500, 'Failed to toggle advertisement status.');
  }
};

// ==================================================
// 23. DELETE ADVERTISEMENT
// DELETE /api/advertisements/:id
// ==================================================

exports.deleteAdvertisement = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return sendError(res, 400, 'Invalid advertisement ID.');
    }

    const advertisement = await Advertisement.findById(id);

    if (!advertisement) {
      return sendError(res, 404, 'Advertisement not found.');
    }

    const imageUrl = advertisement.image;
    const videoUrl = advertisement.video;

    // Delete database document first.
    await advertisement.deleteOne();

    // Remove uploaded files after successful deletion.
    deleteAdFile(imageUrl);
    deleteAdFile(videoUrl);

    return res.status(200).json({
      success: true,
      message: 'Advertisement deleted successfully.',
    });
  } catch (error) {
    console.error('Delete advertisement error:', error);

    return sendError(res, 500, 'Failed to delete advertisement.');
  }
};

// ==================================================
// 24. TRACK ADVERTISEMENT CLICK
// POST /api/advertisements/:id/click
// ==================================================

exports.trackAdvertisementClick = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return sendError(res, 400, 'Invalid advertisement ID.');
    }

    const now = new Date();

    const advertisement = await Advertisement.findOneAndUpdate(
      {
        _id: id,
        isActive: true,
        ...getActiveDateFilter(now),
      },
      {
        $inc: {
          clickCount: 1,
        },
      },
      {
        new: true,
      }
    );

    if (!advertisement) {
      return sendError(res, 404, 'Active advertisement not found.');
    }

    return res.status(200).json({
      success: true,
      message: 'Advertisement click tracked.',
      clickCount: advertisement.clickCount,
    });
  } catch (error) {
    console.error('Track advertisement click error:', error);

    return sendError(res, 500, 'Failed to track advertisement click.');
  }
};

// ==================================================
// 25. TRACK ADVERTISEMENT IMPRESSION
// POST /api/advertisements/:id/impression
// ==================================================

exports.trackAdvertisementImpression = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return sendError(res, 400, 'Invalid advertisement ID.');
    }

    const now = new Date();

    const advertisement = await Advertisement.findOneAndUpdate(
      {
        _id: id,
        isActive: true,
        ...getActiveDateFilter(now),
      },
      {
        $inc: {
          impressionCount: 1,
        },
      },
      {
        new: true,
      }
    );

    if (!advertisement) {
      return sendError(res, 404, 'Active advertisement not found.');
    }

    return res.status(200).json({
      success: true,
      message: 'Advertisement impression tracked.',
      impressionCount: advertisement.impressionCount,
    });
  } catch (error) {
    console.error('Track advertisement impression error:', error);

    return sendError(res, 500, 'Failed to track advertisement impression.');
  }
};
