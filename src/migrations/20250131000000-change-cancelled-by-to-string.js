'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('bookings', 'cancelled_by', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'user atau admin'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('bookings', 'cancelled_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    });
  }
}; 