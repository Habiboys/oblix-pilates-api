'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      User.hasOne(models.Member, { foreignKey: 'user_id', as: 'member' });
      User.hasMany(models.Review, { foreignKey: 'user_id' });
      User.hasMany(models.MemberPackage, { foreignKey: 'user_id' });
      User.hasMany(models.Session, { foreignKey: 'user_id' });
    }
  }
  User.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('admin', 'user'),
      defaultValue: 'user'
    },
    refresh_token: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    reset_token: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    reset_token_expiry: {
      type: DataTypes.DATE,
      allowNull: true,
    }
  }, {
    sequelize,
    modelName: 'User',
    tableName: 'users',
  });
  return User;
};