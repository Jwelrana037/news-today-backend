// ========================================
// 1. Environment Variables Load
// ========================================

require('dotenv').config({
  path: require('path').resolve(__dirname, '../.env'),
});

// ========================================
// 2. Import Packages and Models
// ========================================

const mongoose = require('mongoose');
const crypto = require('crypto');

const Admin = require('../models/Admin');
const AdminInvitation = require('../models/AdminInvitation');

// ========================================
// 3. Create Admin Invitation Function
// ========================================

async function createAdminInvitation() {
  let isConnected = false;

  try {
    // Step 1: .env থেকে Variable গ্রহণ
    const { MONGODB_URI, ADMIN_EMAIL } = process.env;

    // Step 2: Variable যাচাই
    if (!MONGODB_URI || !ADMIN_EMAIL) {
      throw new Error(
        'backend/.env ফাইলে MONGODB_URI এবং ADMIN_EMAIL সেট করুন'
      );
    }

    // Step 3: Client Email প্রস্তুত
    const email = ADMIN_EMAIL.trim().toLowerCase();

    // Step 4: Email-এর সাধারণ Format যাচাই
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      throw new Error('সঠিক ADMIN_EMAIL দিতে হবে');
    }

    // Step 5: MongoDB-তে Connect
    await mongoose.connect(MONGODB_URI);

    isConnected = true;

    console.log('MongoDB Connected Successfully');

    // Step 6: এই Email-এ Admin আগে থেকেই আছে কি না
    const existingAdmin = await Admin.findOne({ email });

    if (existingAdmin) {
      throw new Error(
        'এই Email-এর Admin Account ইতিমধ্যে আছে। নতুন Invitation প্রয়োজন নেই।'
      );
    }

    // Step 7: আগের Invitation থাকলে বাতিল
    await AdminInvitation.deleteMany({ email });

    // Step 8: নিরাপদ Random Token তৈরি
    const token = crypto.randomBytes(32).toString('hex');

    // Step 9: Token-এর SHA-256 Hash তৈরি
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Step 10: Token-এর মেয়াদ ২৪ ঘণ্টা
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Step 11: Database-এ Invitation সংরক্ষণ
    await AdminInvitation.create({
      email,
      tokenHash,
      expiresAt,
      used: false,
    });

    // Step 12: Invitation-এর তথ্য দেখানো
    console.log('\n================================');
    console.log('Admin Invitation Created Successfully!');
    console.log('================================');

    console.log('Client Email:', email);
    console.log('Invitation Token:', token);
    console.log('Expires At:', expiresAt.toISOString());

    console.log('\nToken নিরাপদে সংরক্ষণ করুন।');
    console.log('এই Token ২৪ ঘণ্টা বৈধ থাকবে।');
    console.log('================================\n');
  } catch (error) {
    console.error('\nInvitation Error:', error.message);

    process.exitCode = 1;
  } finally {
    // Step 13: MongoDB Connection বন্ধ
    if (isConnected) {
      await mongoose.disconnect().catch((error) => {
        console.error('MongoDB Disconnect Error:', error.message);
      });
    }
  }
}

// ========================================
// 4. Execute Function
// ========================================

createAdminInvitation();
