const midtransClient = require('midtrans-client');
const config = require('../config/config');

// Initialize Midtrans client
const snap = new midtransClient.Snap({
  isProduction: config.midtrans.isProduction,
  serverKey: config.midtrans.serverKey,
  clientKey: config.midtrans.clientKey
});

// Initialize Core API client for payment status checking
const core = new midtransClient.CoreApi({
  isProduction: config.midtrans.isProduction,
  serverKey: config.midtrans.serverKey,
  clientKey: config.midtrans.clientKey
});

class MidtransService {
  /**
   * Create payment transaction
   */
  static async createTransaction(orderData) {
    try {
      const parameter = {
        transaction_details: {
          order_id: orderData.order_number,
          gross_amount: parseInt(orderData.total_amount)
        },
        customer_details: {
          first_name: orderData.member.full_name,
          email: orderData.member.email,
          phone: orderData.member.phone_number
        },
        item_details: orderData.items.map(item => ({
          id: item.package_id,
          price: parseInt(item.unit_price),
          quantity: item.quantity,
          name: item.package_name
        })),
        callbacks: {
          finish: `${config.app.baseUrl}/payment/finish`,
          error: `${config.app.baseUrl}/payment/error`,
          pending: `${config.app.baseUrl}/payment/pending`
        }
      };

      const transaction = await snap.createTransaction(parameter);
      return transaction;
    } catch (error) {
      console.error('Midtrans create transaction error:', error);
      throw new Error('Failed to create payment transaction');
    }
  }

  /**
   * Get transaction status
   */
  static async getTransactionStatus(orderId) {
    try {
      const status = await core.transaction.status(orderId);
      return status;
    } catch (error) {
      console.error('Midtrans get status error:', error);
      throw new Error('Failed to get transaction status');
    }
  }

  /**
   * Cancel transaction
   */
  static async cancelTransaction(orderId) {
    try {
      const cancel = await core.transaction.cancel(orderId);
      return cancel;
    } catch (error) {
      console.error('Midtrans cancel transaction error:', error);
      throw new Error('Failed to cancel transaction');
    }
  }

  /**
   * Expire transaction
   */
  static async expireTransaction(orderId) {
    try {
      const expire = await core.transaction.expire(orderId);
      return expire;
    } catch (error) {
      console.error('Midtrans expire transaction error:', error);
      throw new Error('Failed to expire transaction');
    }
  }

  /**
   * Refund transaction
   */
  static async refundTransaction(orderId, amount, reason) {
    try {
      const refund = await core.transaction.refund(orderId, {
        refund_amount: amount,
        reason: reason
      });
      return refund;
    } catch (error) {
      console.error('Midtrans refund transaction error:', error);
      throw new Error('Failed to refund transaction');
    }
  }

  /**
   * Handle payment notification
   */
  static async handleNotification(notification) {
    try {
      const status = await core.transaction.notification(notification);
      return status;
    } catch (error) {
      console.error('Midtrans notification error:', error);
      
      // Handle specific 404 error from Midtrans
      if (error.httpStatusCode === '404' || 
          (error.ApiResponse && error.ApiResponse.status_code === '404') ||
          (error.message && error.message.includes("Transaction doesn't exist"))) {
        
        // Re-throw the original error so controller can handle it specifically
        throw error;
      }
      
      // For other errors, throw generic error
      throw new Error('Failed to process payment notification');
    }
  }

  /**
   * Generate order number
   */
  static generateOrderNumber() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ORD-${timestamp}-${random}`;
  }

  /**
   * Map Midtrans status to our status
   */
  static mapPaymentStatus(midtransStatus) {
    const statusMap = {
      'capture': 'paid',
      'settlement': 'paid',
      'pending': 'pending',
      'deny': 'failed',
      'expire': 'expired',
      'cancel': 'cancelled',
      'refund': 'refunded',
      'partial_refund': 'partially_refunded',
      'chargeback': 'chargeback',
      'partial_chargeback': 'partial_chargeback',
      'authorize': 'pending'
    };
    return statusMap[midtransStatus] || 'pending';
  }
}

module.exports = MidtransService; 