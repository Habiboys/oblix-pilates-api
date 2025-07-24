'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PackageFirstTrial extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      PackageFirstTrial.belongsTo(models.Package, {
        foreignKey: 'package_id',
      });
    }
  }
  PackageFirstTrial.init({
    package_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false
    },
    group_session: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    private_session: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'PackageFirstTrial',
    tableName: 'package_first_trial',
    timestamps: true
  });
  return PackageFirstTrial;
}; 