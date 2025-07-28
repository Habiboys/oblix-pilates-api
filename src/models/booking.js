'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Booking extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Booking.belongsTo(models.Schedule, {
        foreignKey: 'schedule_id',
      });
      Booking.belongsTo(models.Member, {
        foreignKey: 'member_id',
      });
      Booking.belongsTo(models.Package, {
        foreignKey: 'package_id',
      });
    }
  }
  Booking.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    schedule_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    member_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    package_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('signup', 'waiting_list', 'cancelled'),
      allowNull: false,
      defaultValue: 'signup'
    },
    attendance: {
      type: DataTypes.ENUM('present', 'absent'),
      allowNull: false,
      defaultValue: 'present'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Booking',
    tableName: 'bookings',
    timestamps: true
  });
  return Booking;
}; 