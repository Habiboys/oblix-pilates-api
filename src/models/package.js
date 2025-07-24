'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Package extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Package.hasOne(models.PackageMembership, {
        foreignKey: 'package_id'
      });
      Package.hasOne(models.PackageFirstTrial, {
        foreignKey: 'package_id',
      });
      Package.hasOne(models.PackagePromo, {
        foreignKey: 'package_id',
      });
      Package.hasOne(models.PackageBonus, {
        foreignKey: 'package_id',
      });
      Package.hasMany(models.Order, {
        foreignKey: 'package_id',
      });
      Package.hasMany(models.MemberPackage, {
        foreignKey: 'package_id',
      });
      Package.hasMany(models.Booking, {
        foreignKey: 'package_id',
      });
    }
  }
  Package.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true
    },
    type: {
      type: DataTypes.ENUM('membership', 'first_trial', 'promo', 'bonus'),
      allowNull: false
    },
    duration_value: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    duration_unit: {
      type: DataTypes.ENUM('week', 'month'),
      allowNull: true
    },
    reminder_day: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    reminder_session: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Package',
    tableName: 'packages',
    timestamps: true
  });
  return Package;
}; 