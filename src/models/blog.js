'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Blog extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  
  Blog.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: {
          msg: 'Title is required'
        },
        len: {
          args: [3, 255],
          msg: 'Title must be between 3 and 255 characters'
        }
      }
    },
    image: {
      type: DataTypes.STRING,
      allowNull: true
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Content is required'
        },
        len: {
          args: [10, 10000],
          msg: 'Content must be between 10 and 10000 characters'
        }
      }
    }
  }, {
    sequelize,
    modelName: 'Blog',
    tableName: 'blogs',
    timestamps: true
  });
  
  return Blog;
}; 