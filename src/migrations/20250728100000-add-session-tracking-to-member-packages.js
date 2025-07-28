'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('member_packages', 'used_group_session', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Jumlah session group yang sudah digunakan'
    });

    await queryInterface.addColumn('member_packages', 'used_private_session', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Jumlah session private yang sudah digunakan'
    });

    await queryInterface.addColumn('member_packages', 'remaining_group_session', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Jumlah session group yang tersisa'
    });

    await queryInterface.addColumn('member_packages', 'remaining_private_session', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Jumlah session private yang tersisa'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('member_packages', 'used_group_session');
    await queryInterface.removeColumn('member_packages', 'used_private_session');
    await queryInterface.removeColumn('member_packages', 'remaining_group_session');
    await queryInterface.removeColumn('member_packages', 'remaining_private_session');
  }
}; 