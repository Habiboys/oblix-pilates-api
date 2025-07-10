'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Payment extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Payment.belongsTo(models.MemberPackage, { foreignKey: 'member_package_id' });
    }
  }
  Payment.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    member_package_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    payment_date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    payment_method: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    amount_paid: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Payment',
    tableName: 'payments',
  });
  return Payment;
};