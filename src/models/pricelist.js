'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PriceList extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      PriceList.belongsTo(models.Package, { foreignKey: 'package_id' });
    }
  }
  PriceList.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    package_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    price: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    validity_weeks: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    is_happy_hour: {
      type: DataTypes.BOOLEAN,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'PriceList',
    tableName: 'price_list',
  });
  return PriceList;
};