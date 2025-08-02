'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('blogs', 'slug', {
      type: Sequelize.STRING(255),
      allowNull: false,
      unique: true,
      after: 'title'
    });

    // Add index untuk slug untuk performa query yang lebih baik
    await queryInterface.addIndex('blogs', ['slug'], {
      unique: true,
      name: 'blogs_slug_unique'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('blogs', 'blogs_slug_unique');
    await queryInterface.removeColumn('blogs', 'slug');
  }
}; 