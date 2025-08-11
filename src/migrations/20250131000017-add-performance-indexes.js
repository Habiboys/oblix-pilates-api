'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add performance indexes for faster queries
    await queryInterface.addIndex('orders', ['order_number'], {
      name: 'idx_orders_order_number',
      unique: true
    });

    await queryInterface.addIndex('orders', ['midtrans_order_id'], {
      name: 'idx_orders_midtrans_order_id'
    });

    await queryInterface.addIndex('orders', ['member_id', 'status'], {
      name: 'idx_orders_member_status'
    });

    await queryInterface.addIndex('orders', ['payment_status', 'status'], {
      name: 'idx_orders_payment_status'
    });

    await queryInterface.addIndex('orders', ['createdAt'], {
      name: 'idx_orders_created_at'
    });

    await queryInterface.addIndex('orders', ['expired_at'], {
      name: 'idx_orders_expired_at'
    });

    // Composite index for common queries
    await queryInterface.addIndex('orders', ['status', 'payment_status', 'createdAt'], {
      name: 'idx_orders_status_payment_created_composite'
    });

    await queryInterface.addIndex('orders', ['status', 'payment_status', 'expired_at'], {
      name: 'idx_orders_status_payment_expired_composite'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove all added indexes
    await queryInterface.removeIndex('orders', 'idx_orders_order_number');
    await queryInterface.removeIndex('orders', 'idx_orders_midtrans_order_id');
    await queryInterface.removeIndex('orders', 'idx_orders_member_status');
    await queryInterface.removeIndex('orders', 'idx_orders_payment_status');
    await queryInterface.removeIndex('orders', 'idx_orders_created_at');
    await queryInterface.removeIndex('orders', 'idx_orders_expired_at');
    await queryInterface.removeIndex('orders', 'idx_orders_status_payment_created_composite');
    await queryInterface.removeIndex('orders', 'idx_orders_status_payment_expired_composite');
  }
};
