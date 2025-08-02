'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Change content column from TEXT to LONGTEXT
      await queryInterface.changeColumn('blogs', 'content', {
        type: Sequelize.TEXT('LONG'),
        allowNull: false
      });
      
      console.log('✅ Blog content column updated to LONGTEXT');
    } catch (error) {
      console.log('❌ Error updating blog content column:', error.message);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Revert back to TEXT
      await queryInterface.changeColumn('blogs', 'content', {
        type: Sequelize.TEXT,
        allowNull: false
      });
      
      console.log('✅ Blog content column reverted to TEXT');
    } catch (error) {
      console.log('❌ Error reverting blog content column:', error.message);
    }
  }
}; 