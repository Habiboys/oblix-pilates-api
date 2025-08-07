'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Class extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Class.hasMany(models.Schedule, {
        foreignKey: 'class_id',
      });
      
      // Association dengan Category
      Class.belongsTo(models.Category, {
        foreignKey: 'category_id'
      });
    }
  }
  Class.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    class_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    color_sign: {
      type: DataTypes.STRING,
      allowNull: false
    },
    category_id: {
      type: DataTypes.UUID,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Class',
    tableName: 'class',
    timestamps: true
  });
  return Class;
}; 