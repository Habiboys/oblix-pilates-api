'use strict';
const bcrypt = require('bcryptjs');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const passwordAdmin = await bcrypt.hash('admin123', 10);
    const passwordUser = await bcrypt.hash('user123', 10);
    await queryInterface.bulkInsert('users', [
      {
        id: Sequelize.literal('UUID()'),
        email: 'admin@oblix.com',
        password: passwordAdmin,
        role: 'admin',
        refresh_token: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: Sequelize.literal('UUID()'),
        email: 'user@oblix.com',
        password: passwordUser,
        role: 'user',
        refresh_token: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', {
      email: ['admin@oblix.com', 'user@oblix.com']
    }, {});
  }
};
