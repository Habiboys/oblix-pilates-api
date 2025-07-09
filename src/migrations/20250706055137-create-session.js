'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sessions', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      member_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'members',
          key: 'id'
        }
      },
      coach_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'coaches',
          key: 'id'
        }
      },
      class_type_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'class_types',
          key: 'id'
        }
      },
      session_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      session_time: {
        type: Sequelize.TIME,
        allowNull: false
      },
      status: {
        type: Sequelize.STRING(50),
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
    await queryInterface.dropTable('sessions');
  }
};