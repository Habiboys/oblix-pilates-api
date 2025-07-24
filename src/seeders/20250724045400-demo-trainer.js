'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('trainers', [
      {
        id: '770e8400-e29b-41d4-a716-446655440001',
        title: 'Coach Lauren',
        description: 'Experienced pilates instructor with 5 years of teaching experience',
        instagram: '@coachlauren',
        tiktok: '@coachlauren',
        picture: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '770e8400-e29b-41d4-a716-446655440002',
        title: 'Coach Sarah',
        description: 'Certified pilates instructor specializing in rehabilitation',
        instagram: '@coachsarah',
        tiktok: '@coachsarah',
        picture: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('trainers', null, {});
  }
}; 