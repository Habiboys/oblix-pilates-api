'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.renameColumn('members', 'profile_picture', 'picture');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.renameColumn('members', 'picture', 'profile_picture');
  }
};
