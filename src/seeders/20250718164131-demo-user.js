'use strict';
const bcrypt = require('bcryptjs');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const passwordAdmin = await bcrypt.hash('admin123', 10);
    const passwordUser = await bcrypt.hash('user123', 10);
    
    // Insert users first
    await queryInterface.bulkInsert('users', [
      {
        id: '770e8400-e29b-41d4-a716-446655440001', // Fixed ID for admin
        email: 'admin@oblix.com',
        password: passwordAdmin,
        role: 'admin',
        refresh_token: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '770e8400-e29b-41d4-a716-446655440002', // Fixed ID for user
        email: 'user@oblix.com',
        password: passwordUser,
        role: 'user',
        refresh_token: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});

    // Insert member profile only for regular user (not admin)
    await queryInterface.bulkInsert('members', [
      {
        id: '880e8400-e29b-41d4-a716-446655440002',
        user_id: '770e8400-e29b-41d4-a716-446655440002', // regular user only
        member_code: 'MBR002',
        username: 'user_oblix',
        full_name: 'User Oblix',
        phone_number: '+6281234567891',
        dob: new Date('1995-01-01'),
        address: 'Bandung, Indonesia',
        date_of_join: new Date(),
        picture: null,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    // Delete members first (due to foreign key constraint)
    await queryInterface.bulkDelete('members', {
      user_id: '770e8400-e29b-41d4-a716-446655440002' // only regular user has member profile
    }, {});
    
    // Then delete users
    await queryInterface.bulkDelete('users', {
      email: ['admin@oblix.com', 'user@oblix.com']
    }, {});
  }
};
