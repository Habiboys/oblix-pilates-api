'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Schedule extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Schedule.belongsTo(models.Class, {
        foreignKey: 'class_id'
      });
      Schedule.belongsTo(models.Trainer, {
        foreignKey: 'trainer_id'
      });
      Schedule.hasMany(models.Booking, {
        foreignKey: 'schedule_id',
      });
      // Self-referencing association untuk repeat schedules
      Schedule.belongsTo(models.Schedule, {
        foreignKey: 'parent_schedule_id',
        as: 'parent'
      });
      Schedule.hasMany(models.Schedule, {
        foreignKey: 'parent_schedule_id',
        as: 'children'
      });

      // Association dengan Member untuk private schedule
      Schedule.belongsTo(models.Member, {
        foreignKey: 'member_id',
        as: 'assignedMember'
      });
    }
  }
  Schedule.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    class_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    picture: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    trainer_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    pax: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM('group', 'semi_private', 'private'),
      allowNull: false
    },
    date_start: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    time_start: {
      type: DataTypes.TIME,
      allowNull: false
    },
    time_end: {
      type: DataTypes.TIME,
      allowNull: false
    },
    repeat_type: {
      type: DataTypes.ENUM('none', 'weekly'),
      allowNull: false,
      defaultValue: 'none'
    },
    repeat_days: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of days to repeat (0=Sunday, 1=Monday, etc.) for weekly repeat schedules'
    },
    schedule_until: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    booking_deadline_hour: {
      type: DataTypes.INTEGER,
      allowNull: false
    },

    min_signup: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    cancel_buffer_minutes: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
            parent_schedule_id: {
          type: DataTypes.UUID,
          allowNull: true
        },
        member_id: {
          type: DataTypes.UUID,
          allowNull: true
        }
  }, {
    sequelize,
    modelName: 'Schedule',
    tableName: 'schedules',
    timestamps: true
  });
  return Schedule;
}; 