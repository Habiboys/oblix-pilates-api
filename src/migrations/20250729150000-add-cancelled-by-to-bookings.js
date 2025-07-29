'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add cancelled_by column to bookings table
    await queryInterface.addColumn('bookings', 'cancelled_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove cancelled_by column from bookings table
    await queryInterface.removeColumn('bookings', 'cancelled_by');
  }
}; 