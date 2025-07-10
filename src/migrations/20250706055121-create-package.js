'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('packages', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      duration_sessions: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      class_type_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'class_types',
          key: 'id'
        }
      },
      is_trial: {
        type: Sequelize.BOOLEAN,
        allowNull: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('packages');
  }
};