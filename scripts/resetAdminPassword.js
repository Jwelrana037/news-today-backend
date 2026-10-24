require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const Admin = require('../models/Admin');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function resetAdminPassword() {
  try {
    if (!process.env.MONGODB_URI && !process.env.MONGO_URI) {
      throw new Error(
        'MongoDB connection variable পাওয়া যায়নি। .env ফাইল পরীক্ষা করো।'
      );
    }

    if (process.env.JWT_SECRET === undefined) {
      throw new Error('JWT_SECRET .env-এ সেট করা আছে কি না পরীক্ষা করো।');
    }

    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

    await mongoose.connect(mongoUri);

    console.log('\n=== Admin Password Reset ===\n');

    const email = (await ask('Admin Email: ')).trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('সঠিক Admin Email দিতে হবে।');
    }

    const admin = await Admin.findOne({ email });

    if (!admin) {
      throw new Error('এই Email দিয়ে কোনো Admin পাওয়া যায়নি।');
    }

    const password = await ask('নতুন Password (কমপক্ষে 12 অক্ষর): ');

    if (password.length < 12) {
      throw new Error('Password কমপক্ষে 12 অক্ষরের হতে হবে।');
    }

    const confirmPassword = await ask('নতুন Password আবার লিখো: ');

    if (password !== confirmPassword) {
      throw new Error('দুটি Password মিলছে না।');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    admin.password = hashedPassword;
    await admin.save();

    console.log('\n✅ Admin Password সফলভাবে পরিবর্তন হয়েছে।');
    console.log('এখন নতুন Password দিয়ে Login করতে পারো।');
  } catch (error) {
    console.error('\n❌ Password Reset Error:', error.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    await mongoose.disconnect().catch(() => {});
  }
}

resetAdminPassword();
