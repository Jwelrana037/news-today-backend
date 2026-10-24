const Advertisement = require('../models/Advertisement');
const fs = require('fs');
const path = require('path');

// সার্ভারে সংরক্ষিত বিজ্ঞাপনের ছবি ডিলিট করার ফাংশন
function deleteAdImage(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return;
  }

  const filename = path.basename(imageUrl);

  // শুধু ads ফোল্ডারের ফাইল ডিলিট করার অনুমতি
  if (!/^ad-[\w-]+.(jpg|jpeg|png|webp|gif)$/i.test(filename)) {
    return;
  }

  const imagePath = path.join(__dirname, '..', 'uploads', 'ads', filename);

  if (fs.existsSync(imagePath)) {
    fs.unlinkSync(imagePath);
  }
}

// নতুন বিজ্ঞাপন তৈরি
exports.createAdvertisement = async (req, res) => {
  try {
    const { title, targetUrl, isActive, startAt, endAt } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'বিজ্ঞাপনের ছবি আপলোড করতে হবে',
      });
    }

    if (
      typeof title !== 'string' ||
      !title.trim() ||
      typeof targetUrl !== 'string' ||
      !targetUrl.trim()
    ) {
      deleteAdImage(req.file.filename);

      return res.status(400).json({
        success: false,
        message: 'বিজ্ঞাপনের নাম ও লিংক দিতে হবে',
      });
    }

    let parsedUrl;

    try {
      parsedUrl = new URL(targetUrl.trim());
    } catch {
      deleteAdImage(req.file.filename);

      return res.status(400).json({
        success: false,
        message: 'সঠিক বিজ্ঞাপনের URL দিতে হবে',
      });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      deleteAdImage(req.file.filename);

      return res.status(400).json({
        success: false,
        message: 'শুধু HTTP অথবা HTTPS লিংক ব্যবহার করা যাবে',
      });
    }

    const image = `/uploads/ads/${req.file.filename}`;

    const advertisement = await Advertisement.create({
      title: title.trim(),
      image,
      targetUrl: parsedUrl.toString(),
      isActive: isActive === undefined ? true : isActive === 'true',
      startAt: startAt || null,
      endAt: endAt || null,
    });

    return res.status(201).json({
      success: true,
      message: 'বিজ্ঞাপন তৈরি হয়েছে',
      advertisement,
    });
  } catch (error) {
    if (req.file) {
      deleteAdImage(req.file.filename);
    }

    console.error('Create Advertisement Error:', error);

    return res.status(500).json({
      success: false,
      message: 'বিজ্ঞাপন তৈরি করা যায়নি',
    });
  }
};

// সব বিজ্ঞাপন দেখা — Admin
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

// চালু থাকা Navbar বিজ্ঞাপন দেখা — Public
exports.getActiveNavbarAdvertisement = async (req, res) => {
  try {
    const now = new Date();

    const advertisement = await Advertisement.findOne({
      isActive: true,
      position: 'navbar',
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
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      advertisement,
    });
  } catch (error) {
    console.error('Get Active Advertisement Error:', error);

    return res.status(500).json({
      success: false,
      message: 'বিজ্ঞাপন লোড করা যায়নি',
    });
  }
};

// বিজ্ঞাপন আপডেট
exports.updateAdvertisement = async (req, res) => {
  let newImageFilename = null;

  try {
    const { title, targetUrl, isActive, startAt, endAt } = req.body;

    const advertisement = await Advertisement.findById(req.params.id);

    if (!advertisement) {
      if (req.file) {
        deleteAdImage(req.file.filename);
      }

      return res.status(404).json({
        success: false,
        message: 'বিজ্ঞাপন পাওয়া যায়নি',
      });
    }

    if (req.file) {
      newImageFilename = req.file.filename;
    }

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        if (req.file) deleteAdImage(req.file.filename);

        return res.status(400).json({
          success: false,
          message: 'বিজ্ঞাপনের নাম ফাঁকা রাখা যাবে না',
        });
      }

      advertisement.title = title.trim();
    }

    if (targetUrl !== undefined) {
      let parsedUrl;

      try {
        parsedUrl = new URL(targetUrl.trim());
      } catch {
        if (req.file) deleteAdImage(req.file.filename);

        return res.status(400).json({
          success: false,
          message: 'সঠিক বিজ্ঞাপনের URL দিতে হবে',
        });
      }

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        if (req.file) deleteAdImage(req.file.filename);

        return res.status(400).json({
          success: false,
          message: 'শুধু HTTP অথবা HTTPS লিংক ব্যবহার করা যাবে',
        });
      }

      advertisement.targetUrl = parsedUrl.toString();
    }

    if (isActive !== undefined) {
      if (!['true', 'false', true, false].includes(isActive)) {
        if (req.file) deleteAdImage(req.file.filename);

        return res.status(400).json({
          success: false,
          message: 'isActive-এর মান true অথবা false হতে হবে',
        });
      }

      advertisement.isActive = isActive === true || isActive === 'true';
    }

    if (startAt !== undefined) {
      advertisement.startAt = startAt ? new Date(startAt) : null;
    }

    if (endAt !== undefined) {
      advertisement.endAt = endAt ? new Date(endAt) : null;
    }

    if (
      advertisement.startAt &&
      advertisement.endAt &&
      advertisement.startAt > advertisement.endAt
    ) {
      if (req.file) deleteAdImage(req.file.filename);

      return res.status(400).json({
        success: false,
        message: 'শুরুর তারিখ শেষের তারিখের পরে হতে পারবে না',
      });
    }

    const oldImage = advertisement.image;

    if (req.file) {
      advertisement.image = `/uploads/ads/${req.file.filename}`;
    }

    await advertisement.save();

    // Database update সফল হওয়ার পর পুরোনো ছবি ডিলিট
    if (req.file) {
      deleteAdImage(oldImage);
      newImageFilename = null;
    }

    return res.status(200).json({
      success: true,
      message: 'বিজ্ঞাপন আপডেট হয়েছে',
      advertisement,
    });
  } catch (error) {
    if (newImageFilename) {
      deleteAdImage(newImageFilename);
    }

    console.error('Update Advertisement Error:', error);

    return res.status(500).json({
      success: false,
      message: 'বিজ্ঞাপন আপডেট করা যায়নি',
    });
  }
};

// বিজ্ঞাপন ডিলিট
exports.deleteAdvertisement = async (req, res) => {
  try {
    const advertisement = await Advertisement.findById(req.params.id);

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'বিজ্ঞাপন পাওয়া যায়নি',
      });
    }

    await Advertisement.deleteOne({ _id: advertisement._id });

    deleteAdImage(advertisement.image);

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

// বিজ্ঞাপন চালু অথবা বন্ধ
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
