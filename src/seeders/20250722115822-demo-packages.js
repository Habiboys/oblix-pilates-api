'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('packages', [
      {
        id: '770e8400-e29b-41d4-a716-446655440001',
        name: '30 Session Group',
        price: 630000,
        type: 'membership',
        duration_value: 30,
        duration_unit: 'week',
        reminder_day: 30,
        reminder_session: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '770e8400-e29b-41d4-a716-446655440002',
        name: '20 Session Group',
        price: 480000,
        type: 'membership',
        duration_value: 20,
        duration_unit: 'week',
        reminder_day: 30,
        reminder_session: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '770e8400-e29b-41d4-a716-446655440003',
        name: '10 Session Group',
        price: 280000,
        type: 'membership',
        duration_value: 10,
        duration_unit: 'week',
        reminder_day: 30,
        reminder_session: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '770e8400-e29b-41d4-a716-446655440004',
        name: 'First Trial Package',
        price: 150000,
        type: 'first_trial',
        duration_value: 2,
        duration_unit: 'week',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '770e8400-e29b-41d4-a716-446655440005',
        name: 'Promo New Year',
        price: 500000,
        type: 'promo',
        duration_value: 25,
        duration_unit: 'week',
        reminder_day: 30,
        reminder_session: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});

    // Insert package membership data
    await queryInterface.bulkInsert('package_membership', [
      {
        package_id: '770e8400-e29b-41d4-a716-446655440001',
        session: 30,
        category_id: '550e8400-e29b-41d4-a716-446655440001', // Pilates Mat
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        package_id: '770e8400-e29b-41d4-a716-446655440002',
        session: 20,
        category_id: '550e8400-e29b-41d4-a716-446655440001', // Pilates Mat
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        package_id: '770e8400-e29b-41d4-a716-446655440003',
        session: 10,
        category_id: '550e8400-e29b-41d4-a716-446655440001', // Pilates Mat
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        package_id: '770e8400-e29b-41d4-a716-446655440005',
        session: 25,
        category_id: '550e8400-e29b-41d4-a716-446655440002', // Pilates Reformer
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('package_membership', null, {});
    await queryInterface.bulkDelete('packages', null, {});
  }
};
