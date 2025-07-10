'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Session extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Session.belongsTo(models.Member, { foreignKey: 'member_id' });
      Session.belongsTo(models.Coach, { foreignKey: 'coach_id' });
      Session.belongsTo(models.ClassType, { foreignKey: 'class_type_id' });
    }
  }
  Session.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    member_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    coach_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    class_type_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    session_date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    session_time: {
      type: DataTypes.TIME,
      allowNull: false
    },
    spot: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Session',
    tableName: 'sessions',
  });
  return Session;
};