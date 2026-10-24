const express = require('express');
const mongoose = require('mongoose');
const BreakingNews = require('../models/BreakingNews');

const router = express.Router();

// GET: Active Breaking News
router.get('/', async (req, res, next) => {
  try {
    const news = await BreakingNews.find({ isActive: true })
      .sort({ priority: -1, publishedAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: news.length,
      data: news,
    });
  } catch (error) {
    next(error);
  }
});

// POST: Create Breaking News
router.post('/', async (req, res, next) => {
  try {
    const { titleBn, titleEn, link, priority } = req.body;

    if (
      typeof titleBn !== 'string' ||
      !titleBn.trim() ||
      typeof titleEn !== 'string' ||
      !titleEn.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'বাংলা ও ইংরেজি শিরোনাম দুটিই দিতে হবে।',
      });
    }

    const parsedPriority = priority === undefined ? 0 : Number(priority);

    if (!Number.isFinite(parsedPriority)) {
      return res.status(400).json({
        success: false,
        message: 'Priority অবশ্যই একটি বৈধ সংখ্যা হতে হবে।',
      });
    }

    const news = await BreakingNews.create({
      titleBn: titleBn.trim(),
      titleEn: titleEn.trim(),
      link: typeof link === 'string' ? link.trim() : '',
      priority: parsedPriority,
    });

    return res.status(201).json({
      success: true,
      message: 'Breaking News যোগ হয়েছে।',
      data: news,
    });
  } catch (error) {
    next(error);
  }
});

// PUT: Update Breaking News
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'News ID সঠিক নয়।',
      });
    }

    const { titleBn, titleEn, link, priority, isActive } = req.body;
    const updates = {};

    if (titleBn !== undefined) {
      if (typeof titleBn !== 'string' || !titleBn.trim()) {
        return res.status(400).json({
          success: false,
          message: 'বাংলা শিরোনাম সঠিক নয়।',
        });
      }

      updates.titleBn = titleBn.trim();
    }

    if (titleEn !== undefined) {
      if (typeof titleEn !== 'string' || !titleEn.trim()) {
        return res.status(400).json({
          success: false,
          message: 'English title is required.',
        });
      }

      updates.titleEn = titleEn.trim();
    }

    if (link !== undefined) {
      if (typeof link !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Link must be text.',
        });
      }

      updates.link = link.trim();
    }

    if (priority !== undefined) {
      const parsedPriority = Number(priority);

      if (!Number.isFinite(parsedPriority)) {
        return res.status(400).json({
          success: false,
          message: 'Priority must be a valid number.',
        });
      }

      updates.priority = parsedPriority;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'isActive must be true or false.',
        });
      }

      updates.isActive = isActive;
    }

    const news = await BreakingNews.findByIdAndUpdate(
      id,
      { $set: updates },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!news) {
      return res.status(404).json({
        success: false,
        message: 'Breaking News পাওয়া যায়নি।',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Breaking News আপডেট হয়েছে।',
      data: news,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE: Delete Breaking News
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'News ID সঠিক নয়।',
      });
    }

    const news = await BreakingNews.findByIdAndDelete(id);

    if (!news) {
      return res.status(404).json({
        success: false,
        message: 'Breaking News পাওয়া যায়নি।',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Breaking News ডিলিট হয়েছে।',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
