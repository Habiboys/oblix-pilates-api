'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('schedules', 'repeat_days', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Array of days to repeat (0=Sunday, 1=Monday, etc.) for weekly repeat schedules'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('schedules', 'repeat_days');
  }
}; 