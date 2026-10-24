require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');

async function createAdmin() {
  try {
    const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

    if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
      throw new Error('Admin Environment Variables not set');
    }

    if (ADMIN_PASSWORD.length < 12) {
      throw new Error('Admin Password must be 12 chareactor');
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const existingAdmin = await Admin.findOne({
      email: ADMIN_EMAIL.trim().toLowerCase(),
    });

    if (existingAdmin) {
      console.log('admin account already exits');
      return;
    }

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

    await Admin.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL.trim().toLowerCase(),
      password: hashedPassword,
      role: 'admin',
    });

    console.log('admin account crated sucess');
  } catch (error) {
    console.error('Admin Setup Error:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

createAdmin();
