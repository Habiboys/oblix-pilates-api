'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('class', [
      {
        id: '660e8400-e29b-41d4-a716-446655440001',
        class_name: 'Beginner Pilates',
        color_sign: '#4CAF50',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440002',
        class_name: 'Intermediate Pilates',
        color_sign: '#2196F3',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440003',
        class_name: 'Advanced Pilates',
        color_sign: '#FF9800',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440004',
        class_name: 'Prenatal Pilates',
        color_sign: '#E91E63',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440005',
        class_name: 'Postnatal Pilates',
        color_sign: '#9C27B0',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('class', null, {});
  }
};
