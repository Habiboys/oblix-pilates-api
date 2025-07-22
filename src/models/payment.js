'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Payment extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Payment.belongsTo(models.Order, {
        foreignKey: 'order_id',
      });
    }
  }
  Payment.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    order_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true
    },
    payment_type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    payment_status: {
      type: DataTypes.ENUM('pending', 'success', 'failed'),
      allowNull: false,
      defaultValue: 'pending'
    },
    transaction_time: {
      type: DataTypes.DATE,
      allowNull: true
    },
    settlement_time: {
      type: DataTypes.DATE,
      allowNull: true
    },
    midtrans_response: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Payment',
    tableName: 'payments',
    timestamps: true
  });
  return Payment;
}; 