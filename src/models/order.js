'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Order extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Order.belongsTo(models.Member, { foreignKey: 'member_id' });
      Order.belongsTo(models.Package, { foreignKey: 'package_id' });
      Order.hasOne(models.MemberPackage, { foreignKey: 'order_id' });
    }
  }
  Order.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    order_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    member_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'members',
        key: 'id'
      }
    },
    package_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'packages',
        key: 'id'
      }
    },
    package_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    package_type: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    unit_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    session_count: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    duration_value: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    duration_unit: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    payment_method: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    payment_status: {
      type: DataTypes.ENUM('pending', 'paid', 'failed', 'expired', 'cancelled'),
      defaultValue: 'pending'
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'cancelled'),
      defaultValue: 'pending'
    },
    midtrans_order_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    midtrans_payment_type: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    midtrans_transaction_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    midtrans_transaction_status: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    midtrans_fraud_status: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    midtrans_va_numbers: {
      type: DataTypes.JSON,
      allowNull: true
    },
    midtrans_payment_code: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    midtrans_pdf_url: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    midtrans_redirect_url: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    midtrans_token: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    paid_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    expired_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    cancelled_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    cancel_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Order',
    tableName: 'orders',
  });
  return Order;
}; 