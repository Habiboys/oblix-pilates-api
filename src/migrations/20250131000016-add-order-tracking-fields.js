'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('orders', 'midtrans_created_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp when order was created in Midtrans'
    });

    await queryInterface.addColumn('orders', 'last_midtrans_check', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Last time we checked order status with Midtrans'
    });

    await queryInterface.addColumn('orders', 'midtrans_check_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Number of times we checked order status with Midtrans'
    });

    await queryInterface.addColumn('orders', 'is_phantom_order', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Flag to identify orders that were never created in Midtrans'
    });

    // Update cancelled_by column to allow string values (for system cancellations)
    await queryInterface.changeColumn('orders', 'cancelled_by', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'User ID or system identifier who cancelled the order'
    });

    // Add index for better performance on expired order queries
    await queryInterface.addIndex('orders', ['status', 'payment_status', 'expired_at'], {
      name: 'idx_orders_status_payment_expired'
    });

    await queryInterface.addIndex('orders', ['status', 'payment_status', 'createdAt'], {
      name: 'idx_orders_status_payment_created'
    });

    await queryInterface.addIndex('orders', ['midtrans_transaction_id'], {
      name: 'idx_orders_midtrans_transaction'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes
    await queryInterface.removeIndex('orders', 'idx_orders_status_payment_expired');
    await queryInterface.removeIndex('orders', 'idx_orders_status_payment_created');
    await queryInterface.removeIndex('orders', 'idx_orders_midtrans_transaction');

    // Remove columns
    await queryInterface.removeColumn('orders', 'midtrans_created_at');
    await queryInterface.removeColumn('orders', 'last_midtrans_check');
    await queryInterface.removeColumn('orders', 'midtrans_check_count');
    await queryInterface.removeColumn('orders', 'is_phantom_order');

    // Revert cancelled_by column
    await queryInterface.changeColumn('orders', 'cancelled_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    });
  }
};
