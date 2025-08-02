'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Check if column already exists
      const tableDescription = await queryInterface.describeTable('blogs');
      
      if (!tableDescription.slug) {
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
      }
    } catch (error) {
      console.log('Column slug might already exist or error occurred:', error.message);
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeIndex('blogs', 'blogs_slug_unique');
      await queryInterface.removeColumn('blogs', 'slug');
    } catch (error) {
      console.log('Error during rollback:', error.message);
    }
  }
}; 