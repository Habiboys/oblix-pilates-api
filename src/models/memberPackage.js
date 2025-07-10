'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class MemberPackage extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      MemberPackage.belongsTo(models.Member, { foreignKey: 'member_id' });
      MemberPackage.belongsTo(models.Package, { foreignKey: 'package_id' });
      MemberPackage.hasMany(models.Payment, { foreignKey: 'member_package_id' });
    }
  }
  MemberPackage.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    member_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    package_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    join_date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    expired_date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    session_used: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    session_left: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    extra_sessions: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'MemberPackage',
    tableName: 'member_packages',
  });
  return MemberPackage;
};