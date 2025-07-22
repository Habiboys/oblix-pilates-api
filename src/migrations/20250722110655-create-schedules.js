'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('schedules', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      class_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'class',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      photo_url: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      trainer_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'trainers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      pax: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      type: {
        type: Sequelize.ENUM('group', 'semi_private', 'private'),
        allowNull: false
      },
      date_start: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      time_start: {
        type: Sequelize.TIME,
        allowNull: false
      },
      time_end: {
        type: Sequelize.TIME,
        allowNull: false
      },
      repeat_type: {
        type: Sequelize.ENUM('none', 'weekly'),
        allowNull: false,
        defaultValue: 'none'
      },
      schedule_until: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      booking_deadline_hour: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      waitlist_lock_minutes: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      min_signup: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      cancel_buffer_minutes: {
        type: Sequelize.INTEGER,
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
    await queryInterface.dropTable('schedules');
  }
};
