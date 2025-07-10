'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Package extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Package.belongsTo(models.ClassType, { foreignKey: 'class_type_id' });
      Package.hasMany(models.PriceList, { foreignKey: 'package_id' });
      Package.hasMany(models.MemberPackage, { foreignKey: 'package_id' });
    }
  }
  Package.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    duration_sessions: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    class_type_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    is_trial: {
      type: DataTypes.BOOLEAN,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Package',
    tableName: 'packages',
  });
  return Package;
};