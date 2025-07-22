'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PackagePromo extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      PackagePromo.belongsTo(models.Package, {
        foreignKey: 'package_id',
      });
    }
  }
  PackagePromo.init({
    package_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false
    },
    group_session: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    private_categories: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: false
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'PackagePromo',
    tableName: 'package_promo',
    timestamps: true
  });
  return PackagePromo;
}; 