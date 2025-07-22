'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PackageBonus extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      PackageBonus.belongsTo(models.Package, {
        foreignKey: 'package_id',
       
      });
    }
  }
  PackageBonus.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    package_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    private_session: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    group_session: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    duration_value: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    duration_unit: {
      type: DataTypes.ENUM('month'),
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'PackageBonus',
    tableName: 'package_bonus',
    timestamps: true
  });
  return PackageBonus;
}; 