'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('member_packages', 'used_semi_private_session', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    });

    await queryInterface.addColumn('member_packages', 'remaining_semi_private_session', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('member_packages', 'used_semi_private_session');
    await queryInterface.removeColumn('member_packages', 'remaining_semi_private_session');
  }
}; 