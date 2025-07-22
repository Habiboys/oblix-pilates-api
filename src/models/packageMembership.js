'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PackageMembership extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      PackageMembership.belongsTo(models.Package, {
        foreignKey: 'package_id',
      });
      PackageMembership.belongsTo(models.Category, {
        foreignKey: 'category_id',
      });
    }
  }
  PackageMembership.init({
    package_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false
    },
    session: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    category_id: {
      type: DataTypes.UUID,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'PackageMembership',
    tableName: 'package_membership',
    timestamps: true
  });
  return PackageMembership;
}; 