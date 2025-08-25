'use strict';

require('dotenv').config();

const bcrypt = require('bcryptjs');
const { User, sequelize } = require('../models');

const ADMIN_EMAIL = 'admin@oblix.com';
const ADMIN_PASSWORD = 'admin123';

async function ensureAdminUser() {
  try {
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

    const existing = await User.findOne({ where: { email: ADMIN_EMAIL } });

    if (existing) {
      const updates = {};
      let changed = false;

      if (existing.role !== 'admin') {
        updates.role = 'admin';
        changed = true;
      }

      const isSamePassword = await bcrypt.compare(ADMIN_PASSWORD, existing.password);
      if (!isSamePassword) {
        updates.password = hashedPassword;
        changed = true;
      }

      if (changed) {
        await existing.update(updates);
        console.log(`✅ Admin user updated: ${ADMIN_EMAIL}`);
      } else {
        console.log(`ℹ️ Admin user already up to date: ${ADMIN_EMAIL}`);
      }
      return existing.id;
    }

    const created = await User.create({
      email: ADMIN_EMAIL,
      password: hashedPassword,
      role: 'admin',
      refresh_token: null
    });

    console.log(`✅ Admin user created: ${ADMIN_EMAIL}`);
    return created.id;
  } catch (err) {
    console.error('❌ Failed to ensure admin user:', err);
    throw err;
  }
}

(async () => {
  try {
    await ensureAdminUser();
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    try { await sequelize.close(); } catch (e) {}
    process.exit(1);
  }
})();


