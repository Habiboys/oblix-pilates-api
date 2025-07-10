'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('members', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      member_code: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      username: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      full_name: {
        type: Sequelize.STRING(150),
        allowNull: false
      },
      phone_number: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      dob: {
        type: Sequelize.DATE,
        allowNull: false
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      date_of_join: {
        type: Sequelize.DATE,
        allowNull: false
      },
      profile_picture: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
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
    await queryInterface.dropTable('members');
  }
};