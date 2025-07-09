'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Membership extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Membership.belongsTo(models.Member, { foreignKey: 'member_id' });
      Membership.belongsTo(models.Package, { foreignKey: 'package_id' });
      Membership.hasMany(models.Payment, { foreignKey: 'membership_id' });
    }
  }
  Membership.init({
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
    modelName: 'Membership',
    tableName: 'membership',
  });
  return Membership;
};