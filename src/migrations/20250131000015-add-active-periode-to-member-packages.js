'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('member_packages', 'active_periode', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Validity period in weeks, copied from package validity_period during order creation'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('member_packages', 'active_periode');
  }
}; 