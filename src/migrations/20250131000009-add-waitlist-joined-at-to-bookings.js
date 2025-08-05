'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('bookings', 'waitlist_joined_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp when booking entered waitlist status'
    });

    // Update existing waitlist bookings to set waitlist_joined_at
    await queryInterface.sequelize.query(`
      UPDATE bookings 
      SET waitlist_joined_at = updated_at 
      WHERE status = 'waiting_list' AND waitlist_joined_at IS NULL
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('bookings', 'waitlist_joined_at');
  }
}; 