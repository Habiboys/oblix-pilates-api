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
      price: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false
      },
      type: {
        type: Sequelize.ENUM('membership', 'first_trial', 'promo', 'bonus'),
        allowNull: false
      },
      duration_value: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      duration_unit: {
        type: Sequelize.ENUM('week', 'month'),
        allowNull: false
      },
      reminder_day: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      reminder_session: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('packages');
  }
};
