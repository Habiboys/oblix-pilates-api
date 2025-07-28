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
    },
    used_group_session: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Jumlah session group yang sudah digunakan'
    },
    used_private_session: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Jumlah session private yang sudah digunakan'
    },
    used_semi_private_session: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Jumlah session semi_private yang sudah digunakan'
    },
    remaining_group_session: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Jumlah session group yang tersisa'
    },
    remaining_semi_private_session: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Jumlah session semi_private yang tersisa'
    },
    remaining_private_session: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Jumlah session private yang tersisa'
    }
  }, {
    sequelize,
    modelName: 'MemberPackage',
    tableName: 'member_packages',
    timestamps: true
  });
  return MemberPackage;
}; 