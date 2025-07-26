'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class MemberPackage extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      MemberPackage.belongsTo(models.Member, {
        foreignKey: 'member_id',
      });
      MemberPackage.belongsTo(models.Package, {
        foreignKey: 'package_id',
      });
      MemberPackage.belongsTo(models.Order, {
        foreignKey: 'order_id',
      });
    }
  }
  MemberPackage.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    member_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    package_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    order_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'MemberPackage',
    tableName: 'member_packages',
    timestamps: true
  });
  return MemberPackage;
}; 