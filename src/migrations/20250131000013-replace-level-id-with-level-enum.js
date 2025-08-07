'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop foreign key constraint first
    await queryInterface.removeColumn('schedules', 'level_id');
    
    // Add level enum column
    await queryInterface.addColumn('schedules', 'level', {
      type: Sequelize.ENUM('Basic', 'Flow'),
      allowNull: true,
      after: 'trainer_id'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove level enum column
    await queryInterface.removeColumn('schedules', 'level');
    
    // Add back level_id column
    await queryInterface.addColumn('schedules', 'level_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'levels',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  }
}; 