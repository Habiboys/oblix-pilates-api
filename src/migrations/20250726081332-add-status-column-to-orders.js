'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add status column to orders table
    await queryInterface.addColumn('orders', 'status', {
      type: Sequelize.ENUM('pending', 'processing', 'completed', 'cancelled'),
      defaultValue: 'pending',
      allowNull: false
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove status column from orders table
    await queryInterface.removeColumn('orders', 'status');
  }
};
