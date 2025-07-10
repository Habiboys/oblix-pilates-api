'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Coach extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Coach.hasMany(models.Session, { foreignKey: 'coach_id' });
    }
  }
  Coach.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    photo: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    instagram: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    tiktok: {
      type: DataTypes.STRING(255),
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Coach',
    tableName: 'coaches',
  });
  return Coach;
};