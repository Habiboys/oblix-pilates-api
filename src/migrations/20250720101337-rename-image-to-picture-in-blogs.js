'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.renameColumn('blogs', 'image', 'picture');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.renameColumn('blogs', 'picture', 'image');
  }
};
