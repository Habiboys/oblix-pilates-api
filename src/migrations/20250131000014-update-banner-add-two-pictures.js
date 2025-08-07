'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Rename existing picture column to picturePortrait
    await queryInterface.renameColumn('banners', 'picture', 'picturePortrait');
    
    // Add pictureLandscape column
    await queryInterface.addColumn('banners', 'pictureLandscape', {
      type: Sequelize.STRING(255),
      allowNull: true,
      after: 'picturePortrait'
    });
    
    // Modify picturePortrait to allow null (since either one or both can be present)
    await queryInterface.changeColumn('banners', 'picturePortrait', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove pictureLandscape column
    await queryInterface.removeColumn('banners', 'pictureLandscape');
    
    // Rename picturePortrait back to picture
    await queryInterface.renameColumn('banners', 'picturePortrait', 'picture');
    
    // Change picture back to not null
    await queryInterface.changeColumn('banners', 'picture', {
      type: Sequelize.STRING(255),
      allowNull: false
    });
  }
}; 