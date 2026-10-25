const Advertisement = require('../models/Advertisement');
const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'ads');

// সব অনুমোদিত বিজ্ঞাপনের ধরন
const VALID_ADVERTISEMENT_TYPES = ['image', 'video', 'animated'];

// সব অনুমোদিত বিজ্ঞাপনের পজিশন
const VALID_ADVERTISEMENT_POSITIONS = [
  // পুরোনো পজিশন
  'navbar',
  'header',
  'breaking-news',

  // Homepage
  'homepage-top',
  'homepage-middle',
  'homepage-bottom',

  // Article
  'in-article',
  'article-bottom',

  // অন্যান্য
  'sidebar',
  'footer',
  'popup',
];

// অনুমোদিত Animation
const VALID_ANIMATIONS = ['none', 'fade', 'slide', 'zoom'];

// --------------------------------------------------
// বিজ্ঞাপনের ফাইল ডিলিট
// --------------------------------------------------

function deleteAdFile(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string') {
    return;
  }

  const filename = path.basename(fileUrl);

  // শুধু আমাদের তৈরি বিজ্ঞাপনের ফাইল ডিলিট হবে
  if (
    !/^ad-(?:video-)?[\w-]+\.(jpg|jpeg|png|webp|gif|mp4|webm)$/i.test(filename)
  ) {
    return;
  }

  const filePath = path.join(UPLOAD_DIR, filename);

  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error('Advertisement File Delete Error:', error);
    }
  }
}

// --------------------------------------------------
// Boolean যাচাই
// --------------------------------------------------

function parseBoolean(value, defaultValue = true) {
  if (value === undefined) {
    return defaultValue;
  }

  if (value === true || value === 'true') {
    return true;
  }

  if (value === false || value === 'false') {
    return false;
  }

  return null;
}

// --------------------------------------------------
// বিজ্ঞাপনের URL যাচাই
// --------------------------------------------------

function validateTargetUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return {
      error: 'বিজ্ঞাপনের লিংক দিতে হবে',
    };
  }

  try {
    const url = new URL(value.trim());

    if (!['http:', 'https:'].includes(url.protocol)) {
      return {
        error: 'শুধু HTTP অথবা HTTPS লিংক ব্যবহার করা যাবে',
      };
    }

    return {
      value: url.toString(),
    };
  } catch {
    return {
      error: 'সঠিক বিজ্ঞাপনের URL দিতে হবে',
    };
  }
}

// --------------------------------------------------
// তারিখ যাচাই
// --------------------------------------------------

function validateDates(startAt, endAt) {
  const start =
    startAt === undefined || startAt === null || startAt === ''
      ? null
      : new Date(startAt);

  const end =
    endAt === undefined || endAt === null || endAt === ''
      ? null
      : new Date(endAt);

  if (start && Number.isNaN(start.getTime())) {
    return {
      error: 'শুরুর তারিখ সঠিক নয়',
    };
  }

  if (end && Number.isNaN(end.getTime())) {
    return {
      error: 'শেষের তারিখ সঠিক নয়',
    };
  }

  if (start && end && start > end) {
    return {
      error: 'শুরুর তারিখ শেষের তারিখের পরে হতে পারবে না',
    };
  }

  return {
    start,
    end,
  };
}

// --------------------------------------------------
// অনুমোদিত ফিল্ড সংগ্রহ
// --------------------------------------------------

function getAllowedFields(body) {
  const fields = [
    'type',
    'position',
    'headline',
    'description',
    'price',
    'offer',
    'contact',
    'backgroundColor',
    'textColor',
    'animation',
    'durationSeconds',
  ];

  const result = {};

  for (const field of fields) {
    if (body[field] !== undefined) {
      result[field] = body[field];
    }
  }

  return result;
}

// --------------------------------------------------
// Public API-তে বিজ্ঞাপন দেখানোর জন্য Date Filter
// --------------------------------------------------

function getActiveAdvertisementDateFilter(now) {
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
}

// --------------------------------------------------
// নতুন বিজ্ঞাপন তৈরি — Admin
// --------------------------------------------------

exports.createAdvertisement = async (req, res) => {
  let uploadedFileUrl = null;

  try {
    const { title, targetUrl, isActive, startAt, endAt } = req.body;

    const type = req.body.type || 'image';

    // বিজ্ঞাপনের নাম যাচাই
    if (typeof title !== 'string' || !title.trim()) {
      if (req.file) {
        deleteAdFile(req.file.filename);
      }

      return res.status(400).json({
        success: false,
        message: 'বিজ্ঞাপনের নাম দিতে হবে',
      });
    }

    // বিজ্ঞাপনের ধরন যাচাই
    if (!VALID_ADVERTISEMENT_TYPES.includes(type)) {
      if (req.file) {
        deleteAdFile(req.file.filename);
      }

      return res.status(400).json({
        success: false,
        message: 'বিজ্ঞাপনের ধরন সঠিক নয়',
      });
    }

    // বিজ্ঞাপনের পজিশন
    // নতুন বিজ্ঞাপনের ডিফল্ট পজিশন header
    const position = req.body.position || 'header';

    if (!VALID_ADVERTISEMENT_POSITIONS.includes(position)) {
      if (req.file) {
        deleteAdFile(req.file.filename);
      }

      return res.status(400).json({
        success: false,
        message: 'বিজ্ঞাপন দেখানোর স্থান সঠিক নয়',
      });
    }

    // বিজ্ঞাপনের লিংক যাচাই
    const urlResult = validateTargetUrl(targetUrl);

    if (urlResult.error) {
      if (req.file) {
        deleteAdFile(req.file.filename);
      }

      return res.status(400).json({
        success: false,
        message: urlResult.error,
      });
    }

    // তারিখ যাচাই
    const dateResult = validateDates(startAt, endAt);

    if (dateResult.error) {
      if (req.file) {
        deleteAdFile(req.file.filename);
      }

      return res.status(400).json({
        success: false,
        message: dateResult.error,
      });
    }

    // Image ও Video বিজ্ঞাপনের ফাইল বাধ্যতামূলক
    if ((type === 'image' || type === 'video') && !req.file) {
      return res.status(400).json({
        success: false,
        message:
          type === 'video'
            ? 'বিজ্ঞাপনের ভিডিও আপলোড করতে হবে'
            : 'বিজ্ঞাপনের ছবি আপলোড করতে হবে',
      });
    }

    // Active Status যাচাই
    const activeValue = parseBoolean(isActive, true);

    if (activeValue === null) {
      if (req.file) {
        deleteAdFile(req.file.filename);
      }

      return res.status(400).json({
        success: false,
        message: 'isActive-এর মান true অথবা false হতে হবে',
      });
    }

    // Animation যাচাই
    if (
      req.body.animation !== undefined &&
      !VALID_ANIMATIONS.includes(req.body.animation)
    ) {
      if (req.file) {
        deleteAdFile(req.file.filename);
      }

      return res.status(400).json({
        success: false,
        message: 'বিজ্ঞাপনের Animation সঠিক নয়',
      });
    }

    // আপলোড করা ফাইলের URL
    const fileUrl = req.file ? `/uploads/ads/${req.file.filename}` : '';

    uploadedFileUrl = fileUrl || null;

    // অতিরিক্ত অনুমোদিত ফিল্ড
    const extraFields = getAllowedFields(req.body);

    // বিজ্ঞাপনের ডেটা
    const advertisementData = {
      ...extraFields,

      title: title.trim(),
      type,
      targetUrl: urlResult.value,
      position,

      isActive: activeValue,

      startAt: dateResult.start,
      endAt: dateResult.end,
    };

    // Image অথবা Video সংরক্ষণ
    if (req.file) {
      if (type === 'video') {
        advertisementData.video = fileUrl;
      } else {
        advertisementData.image = fileUrl;
      }
    }

    // Database-এ বিজ্ঞাপন তৈরি
    const advertisement = await Advertisement.create(advertisementData);

    // সফলভাবে Database-এ সংরক্ষণ হয়েছে
    uploadedFileUrl = null;

    return res.status(201).json({
      success: true,
      message: 'বিজ্ঞাপন তৈরি হয়েছে',
      advertisement,
    });
  } catch (error) {
    if (uploadedFileUrl) {
      deleteAdFile(uploadedFileUrl);
    }

    console.error('Create Advertisement Error:', error);

    // Mongoose validation error
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'বিজ্ঞাপনের তথ্য সঠিক নয়',
        errors: Object.values(error.errors).map((item) => item.message),
      });
    }

    return res.status(500).json({
      success: false,
      message: 'বিজ্ঞাপন তৈরি করা যায়নি',
    });
  }
};

// --------------------------------------------------
// সব বিজ্ঞাপন দেখা — Admin
// --------------------------------------------------

exports.getAllAdvertisements = async (req, res) => {
  try {
    const advertisements = await Advertisement.find().sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: advertisements.length,
      advertisements,
    });
  } catch (error) {
    console.error('Get Advertisements Error:', error);

    return res.status(500).json({
      success: false,
      message: 'বিজ্ঞাপন লোড করা যায়নি',
    });
  }
};

// --------------------------------------------------
// নির্দিষ্ট পজিশনের চালু বিজ্ঞাপন — Public
// --------------------------------------------------

exports.getActiveAdvertisementsByPosition = async (req, res) => {
  try {
    const { position } = req.params;

    // পজিশন যাচাই
    if (!VALID_ADVERTISEMENT_POSITIONS.includes(position)) {
      return res.status(400).json({
        success: false,
        message: 'বিজ্ঞাপন দেখানোর স্থান সঠিক নয়',
      });
    }

    const now = new Date();

    // চালু এবং নির্ধারিত সময়ের মধ্যে থাকা বিজ্ঞাপন
    const advertisements = await Advertisement.find({
      isActive: true,
      position,
      ...getActiveAdvertisementDateFilter(now),
    }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: advertisements.length,
      advertisements,
    });
  } catch (error) {
    console.error('Get Position Advertisements Error:', error);

    return res.status(500).json({
      success: false,
      message: 'বিজ্ঞাপন লোড করা যায়নি',
    });
  }
};

// --------------------------------------------------
// পুরোনো Navbar API — Public
// --------------------------------------------------

exports.getActiveNavbarAdvertisement = async (req, res) => {
  try {
    const now = new Date();

    const advertisement = await Advertisement.findOne({
      isActive: true,
      position: 'navbar',
      ...getActiveAdvertisementDateFilter(now),
    }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      advertisement,
    });
  } catch (error) {
    console.error('Get Active Navbar Advertisement Error:', error);

    return res.status(500).json({
      success: false,
      message: 'বিজ্ঞাপন লোড করা যায়নি',
    });
  }
};

// --------------------------------------------------
// বিজ্ঞাপন আপডেট — Admin
// --------------------------------------------------

exports.updateAdvertisement = async (req, res) => {
  let newFileUrl = null;

  try {
    const advertisement = await Advertisement.findById(req.params.id);

    if (!advertisement) {
      if (req.file) {
        deleteAdFile(req.file.filename);
      }

      return res.status(404).json({
        success: false,
        message: 'বিজ্ঞাপন পাওয়া যায়নি',
      });
    }

    const { title, targetUrl, isActive, startAt, endAt } = req.body;

    // বিজ্ঞাপনের নাম আপডেট
    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        if (req.file) {
          deleteAdFile(req.file.filename);
        }

        return res.status(400).json({
          success: false,
          message: 'বিজ্ঞাপনের নাম ফাঁকা রাখা যাবে না',
        });
      }

      advertisement.title = title.trim();
    }

    // বিজ্ঞাপনের লিংক আপডেট
    if (targetUrl !== undefined) {
      const urlResult = validateTargetUrl(targetUrl);

      if (urlResult.error) {
        if (req.file) {
          deleteAdFile(req.file.filename);
        }

        return res.status(400).json({
          success: false,
          message: urlResult.error,
        });
      }

      advertisement.targetUrl = urlResult.value;
    }

    // বিজ্ঞাপনের Active Status আপডেট
    if (isActive !== undefined) {
      const activeValue = parseBoolean(isActive, null);

      if (activeValue === null) {
        if (req.file) {
          deleteAdFile(req.file.filename);
        }

        return res.status(400).json({
          success: false,
          message: 'isActive-এর মান true অথবা false হতে হবে',
        });
      }

      advertisement.isActive = activeValue;
    }

    // নতুন Start Date
    if (startAt !== undefined) {
      advertisement.startAt = startAt ? new Date(startAt) : null;
    }

    // নতুন End Date
    if (endAt !== undefined) {
      advertisement.endAt = endAt ? new Date(endAt) : null;
    }

    // তারিখ যাচাই
    const dateResult = validateDates(
      advertisement.startAt,
      advertisement.endAt
    );

    if (dateResult.error) {
      if (req.file) {
        deleteAdFile(req.file.filename);
      }

      return res.status(400).json({
        success: false,
        message: dateResult.error,
      });
    }

    // অতিরিক্ত ফিল্ড সংগ্রহ
    const allowedFields = getAllowedFields(req.body);

    // Position আপডেটের আগে যাচাই
    if (
      allowedFields.position !== undefined &&
      !VALID_ADVERTISEMENT_POSITIONS.includes(allowedFields.position)
    ) {
      if (req.file) {
        deleteAdFile(req.file.filename);
      }

      return res.status(400).json({
        success: false,
        message: 'বিজ্ঞাপন দেখানোর স্থান সঠিক নয়',
      });
    }

    // Type আপডেটের আগে যাচাই
    if (
      allowedFields.type !== undefined &&
      !VALID_ADVERTISEMENT_TYPES.includes(allowedFields.type)
    ) {
      if (req.file) {
        deleteAdFile(req.file.filename);
      }

      return res.status(400).json({
        success: false,
        message: 'বিজ্ঞাপনের ধরন সঠিক নয়',
      });
    }

    // Animation আপডেটের আগে যাচাই
    if (
      allowedFields.animation !== undefined &&
      !VALID_ANIMATIONS.includes(allowedFields.animation)
    ) {
      if (req.file) {
        deleteAdFile(req.file.filename);
      }

      return res.status(400).json({
        success: false,
        message: 'বিজ্ঞাপনের Animation সঠিক নয়',
      });
    }

    // অনুমোদিত ফিল্ড আপডেট
    for (const [key, value] of Object.entries(allowedFields)) {
      advertisement[key] = value;
    }

    // নতুন Image অথবা Video আপলোড হলে
    if (req.file) {
      newFileUrl = `/uploads/ads/${req.file.filename}`;

      const uploadType = req.body.type || advertisement.type || 'image';

      if (!VALID_ADVERTISEMENT_TYPES.includes(uploadType)) {
        deleteAdFile(newFileUrl);
        newFileUrl = null;

        return res.status(400).json({
          success: false,
          message: 'বিজ্ঞাপনের ধরন সঠিক নয়',
        });
      }

      if (uploadType === 'video') {
        const oldFile = advertisement.video;

        advertisement.video = newFileUrl;

        await advertisement.save();

        // নতুন ফাইল সংরক্ষণের পর পুরোনো ফাইল ডিলিট
        if (oldFile && oldFile !== newFileUrl) {
          deleteAdFile(oldFile);
        }
      } else {
        const oldFile = advertisement.image;

        advertisement.image = newFileUrl;

        await advertisement.save();

        // নতুন ফাইল সংরক্ষণের পর পুরোনো ফাইল ডিলিট
        if (oldFile && oldFile !== newFileUrl) {
          deleteAdFile(oldFile);
        }
      }

      newFileUrl = null;
    } else {
      await advertisement.save();
    }

    return res.status(200).json({
      success: true,
      message: 'বিজ্ঞাপন আপডেট হয়েছে',
      advertisement,
    });
  } catch (error) {
    if (newFileUrl) {
      deleteAdFile(newFileUrl);
    }

    console.error('Update Advertisement Error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'বিজ্ঞাপনের তথ্য সঠিক নয়',
        errors: Object.values(error.errors).map((item) => item.message),
      });
    }

    return res.status(500).json({
      success: false,
      message: 'বিজ্ঞাপন আপডেট করা যায়নি',
    });
  }
};

// --------------------------------------------------
// বিজ্ঞাপন ডিলিট — Admin
// --------------------------------------------------

exports.deleteAdvertisement = async (req, res) => {
  try {
    const advertisement = await Advertisement.findById(req.params.id);

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'বিজ্ঞাপন পাওয়া যায়নি',
      });
    }

    await Advertisement.deleteOne({
      _id: advertisement._id,
    });

    // বিজ্ঞাপনের Image ও Video ফাইল ডিলিট
    deleteAdFile(advertisement.image);
    deleteAdFile(advertisement.video);

    return res.status(200).json({
      success: true,
      message: 'বিজ্ঞাপন ডিলিট হয়েছে',
    });
  } catch (error) {
    console.error('Delete Advertisement Error:', error);

    return res.status(500).json({
      success: false,
      message: 'বিজ্ঞাপন ডিলিট করা যায়নি',
    });
  }
};

// --------------------------------------------------
// বিজ্ঞাপন চালু অথবা বন্ধ — Admin
// --------------------------------------------------

exports.toggleAdvertisement = async (req, res) => {
  try {
    const advertisement = await Advertisement.findById(req.params.id);

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'বিজ্ঞাপন পাওয়া যায়নি',
      });
    }

    advertisement.isActive = !advertisement.isActive;

    await advertisement.save();

    return res.status(200).json({
      success: true,
      message: advertisement.isActive
        ? 'বিজ্ঞাপন চালু হয়েছে'
        : 'বিজ্ঞাপন বন্ধ হয়েছে',
      advertisement,
    });
  } catch (error) {
    console.error('Toggle Advertisement Error:', error);

    return res.status(500).json({
      success: false,
      message: 'বিজ্ঞাপনের অবস্থা পরিবর্তন করা যায়নি',
    });
  }
};
