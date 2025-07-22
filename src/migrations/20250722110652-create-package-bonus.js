'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('package_bonus', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      package_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'packages',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      private_session: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      group_session: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      duration_value: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      duration_unit: {
        type: Sequelize.ENUM('month'),
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
    await queryInterface.dropTable('package_bonus');
  }
};
