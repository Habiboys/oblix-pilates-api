'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn('bookings', 'session_left');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('bookings', 'session_left', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    });
  }
}; 