'use strict';

const bcrypt = require('bcryptjs');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create demo users first
    const users = await queryInterface.bulkInsert('users', [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        email: 'john.doe@example.com',
        password: await bcrypt.hash('password123', 10),
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        email: 'jane.smith@example.com',
        password: await bcrypt.hash('password123', 10),
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        email: 'mike.wilson@example.com',
        password: await bcrypt.hash('password123', 10),
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440004',
        email: 'sarah.johnson@example.com',
        password: await bcrypt.hash('password123', 10),
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440005',
        email: 'david.brown@example.com',
        password: await bcrypt.hash('password123', 10),
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], { returning: true });

    // Create demo members
    await queryInterface.bulkInsert('members', [
      {
        id: '660e8400-e29b-41d4-a716-446655440001',
        member_code: 'MBR240001',
        username: 'johndoe',
        full_name: 'John Doe',
        phone_number: '081234567890',
        dob: '1990-05-15',
        address: 'Jl. Sudirman No. 123, Jakarta Pusat',
        date_of_join: '2024-01-15',
        picture: 'https://example.com/john-doe.jpg',
        status: 'active',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440002',
        member_code: 'MBR240002',
        username: 'janesmith',
        full_name: 'Jane Smith',
        phone_number: '081234567891',
        dob: '1988-08-22',
        address: 'Jl. Thamrin No. 456, Jakarta Pusat',
        date_of_join: '2024-02-20',
        picture: 'https://example.com/jane-smith.jpg',
        status: 'active',
        user_id: '550e8400-e29b-41d4-a716-446655440002',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440003',
        member_code: 'MBR240003',
        username: 'mikewilson',
        full_name: 'Mike Wilson',
        phone_number: '081234567892',
        dob: '1992-03-10',
        address: 'Jl. Gatot Subroto No. 789, Jakarta Selatan',
        date_of_join: '2024-03-10',
        picture: 'https://example.com/mike-wilson.jpg',
        status: 'active',
        user_id: '550e8400-e29b-41d4-a716-446655440003',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440004',
        member_code: 'MBR240004',
        username: 'sarahjohnson',
        full_name: 'Sarah Johnson',
        phone_number: '081234567893',
        dob: '1995-12-05',
        address: 'Jl. Kebayoran Baru No. 321, Jakarta Selatan',
        date_of_join: '2024-04-05',
        picture: 'https://example.com/sarah-johnson.jpg',
        status: 'active',
        user_id: '550e8400-e29b-41d4-a716-446655440004',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440005',
        member_code: 'MBR240005',
        username: 'davidbrown',
        full_name: 'David Brown',
        phone_number: '081234567894',
        dob: '1985-07-18',
        address: 'Jl. Senayan No. 654, Jakarta Pusat',
        date_of_join: '2024-05-12',
        picture: 'https://example.com/david-brown.jpg',
        status: 'inactive',
        user_id: '550e8400-e29b-41d4-a716-446655440005',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    // Delete members first (due to foreign key constraint)
    await queryInterface.bulkDelete('members', {
      id: [
        '660e8400-e29b-41d4-a716-446655440001',
        '660e8400-e29b-41d4-a716-446655440002',
        '660e8400-e29b-41d4-a716-446655440003',
        '660e8400-e29b-41d4-a716-446655440004',
        '660e8400-e29b-41d4-a716-446655440005'
      ]
    });

    // Delete users
    await queryInterface.bulkDelete('users', {
      id: [
        '550e8400-e29b-41d4-a716-446655440001',
        '550e8400-e29b-41d4-a716-446655440002',
        '550e8400-e29b-41d4-a716-446655440003',
        '550e8400-e29b-41d4-a716-446655440004',
        '550e8400-e29b-41d4-a716-446655440005'
      ]
    });
  }
}; 