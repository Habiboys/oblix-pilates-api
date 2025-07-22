'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Get category IDs first
    const categories = await queryInterface.sequelize.query(
      `SELECT id FROM categories LIMIT 3;`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (categories.length === 0) {
      console.log('No categories found. Please run category seeder first.');
      return;
    }

    const categoryIds = categories.map(cat => cat.id);

    // Insert membership packages
    const packages = await queryInterface.bulkInsert('packages', [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Premium Membership 3 Months',
        price: 1500000,
        type: 'membership',
        duration_value: 3,
        duration_unit: 'month',
        reminder_day: 7,
        reminder_session: 2,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Basic Membership 1 Month',
        price: 500000,
        type: 'membership',
        duration_value: 1,
        duration_unit: 'month',
        reminder_day: 5,
        reminder_session: 1,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        name: 'Premium Membership 6 Months',
        price: 2800000,
        type: 'membership',
        duration_value: 6,
        duration_unit: 'month',
        reminder_day: 10,
        reminder_session: 3,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440004',
        name: 'Weekly Membership',
        price: 150000,
        type: 'membership',
        duration_value: 1,
        duration_unit: 'week',
        reminder_day: 2,
        reminder_session: 1,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440005',
        name: 'Annual Membership',
        price: 5000000,
        type: 'membership',
        duration_value: 12,
        duration_unit: 'month',
        reminder_day: 15,
        reminder_session: 5,
        created_at: new Date(),
        updated_at: new Date()
      }
    ], { returning: true });

    // Insert package membership details
    await queryInterface.bulkInsert('package_membership', [
      {
        id: '660e8400-e29b-41d4-a716-446655440001',
        package_id: '550e8400-e29b-41d4-a716-446655440001',
        session: 12,
        category_id: categoryIds[0],
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440002',
        package_id: '550e8400-e29b-41d4-a716-446655440002',
        session: 4,
        category_id: categoryIds[1],
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440003',
        package_id: '550e8400-e29b-41d4-a716-446655440003',
        session: 24,
        category_id: categoryIds[0],
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440004',
        package_id: '550e8400-e29b-41d4-a716-446655440004',
        session: 2,
        category_id: categoryIds[2],
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440005',
        package_id: '550e8400-e29b-41d4-a716-446655440005',
        session: 48,
        category_id: categoryIds[0],
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    // Delete package membership first (due to foreign key constraint)
    await queryInterface.bulkDelete('package_membership', {
      package_id: {
        [Sequelize.Op.in]: [
          '550e8400-e29b-41d4-a716-446655440001',
          '550e8400-e29b-41d4-a716-446655440002',
          '550e8400-e29b-41d4-a716-446655440003',
          '550e8400-e29b-41d4-a716-446655440004',
          '550e8400-e29b-41d4-a716-446655440005'
        ]
      }
    });

    // Delete packages
    await queryInterface.bulkDelete('packages', {
      id: {
        [Sequelize.Op.in]: [
          '550e8400-e29b-41d4-a716-446655440001',
          '550e8400-e29b-41d4-a716-446655440002',
          '550e8400-e29b-41d4-a716-446655440003',
          '550e8400-e29b-41d4-a716-446655440004',
          '550e8400-e29b-41d4-a716-446655440005'
        ]
      }
    });
  }
}; 