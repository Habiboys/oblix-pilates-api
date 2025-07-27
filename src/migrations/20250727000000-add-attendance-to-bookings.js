'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('bookings', 'attendance', {
      type: Sequelize.ENUM('present', 'absent'),
      allowNull: false,
      defaultValue: 'present'
    });

    await queryInterface.addColumn('bookings', 'notes', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('bookings', 'attendance');
    await queryInterface.removeColumn('bookings', 'notes');
  }
}; 