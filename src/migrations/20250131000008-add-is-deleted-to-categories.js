'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('categories', 'is_deleted', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    // Add index for better performance
    await queryInterface.addIndex('categories', ['is_deleted']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('categories', ['is_deleted']);
    await queryInterface.removeColumn('categories', 'is_deleted');
  }
}; 