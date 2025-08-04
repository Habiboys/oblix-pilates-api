'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('packages', 'is_deleted', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'reminder_session'
    });

    // Add index untuk optimasi query
    await queryInterface.addIndex('packages', ['is_deleted'], {
      name: 'idx_packages_is_deleted'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('packages', 'idx_packages_is_deleted');
    await queryInterface.removeColumn('packages', 'is_deleted');
  }
}; 