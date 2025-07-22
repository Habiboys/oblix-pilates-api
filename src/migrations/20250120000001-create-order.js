'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('orders', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      order_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      member_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'members',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      package_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'packages',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      package_name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      package_type: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      unit_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      total_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      session_count: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      duration_value: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      duration_unit: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      payment_method: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      payment_status: {
        type: Sequelize.ENUM('pending', 'paid', 'failed', 'expired', 'cancelled'),
        defaultValue: 'pending'
      },
      midtrans_order_id: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      midtrans_payment_type: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      midtrans_transaction_id: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      midtrans_transaction_status: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      midtrans_fraud_status: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      midtrans_va_numbers: {
        type: Sequelize.JSON,
        allowNull: true
      },
      midtrans_pdf_url: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      midtrans_redirect_url: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      paid_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      expired_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Add indexes
    await queryInterface.addIndex('orders', ['order_number']);
    await queryInterface.addIndex('orders', ['member_id']);
    await queryInterface.addIndex('orders', ['package_id']);
    await queryInterface.addIndex('orders', ['payment_status']);
    await queryInterface.addIndex('orders', ['midtrans_order_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('orders');
  }
}; 