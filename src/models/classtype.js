'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ClassType extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      ClassType.hasMany(models.Package, { foreignKey: 'class_type_id' });
      ClassType.hasMany(models.Session, { foreignKey: 'class_type_id' });
    }
  }
  ClassType.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    max_participant: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    image_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'ClassType',
    tableName: 'class_types',
  });
  return ClassType;
};