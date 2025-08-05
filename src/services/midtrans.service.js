const midtransClient = require('midtrans-client');
const config = require('../config/config');
const logger = require('../config/logger');

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
      // Calculate expired time
      const expiredTime = new Date();
      expiredTime.setMinutes(expiredTime.getMinutes() + config.midtrans.expiredTime);
      
      // Format start_time sesuai format Midtrans: yyyy-MM-dd hh:mm:ss Z
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const startTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds} +0700`;
      
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
          finish: `${config.app.baseURL}/api/order/payment/finish`,
          error: `${config.app.baseURL}/api/order/payment/error`,
          pending: `${config.app.baseURL}/api/order/payment/pending`
        },
        // Add notification URL for payment notifications (including re-payment)
        // This URL will receive HTTP notifications from Midtrans for payment status changes
        notification_url: `${config.app.baseURL}/api/order/payment/notification`,
        // Add expired time configuration
        expiry: {
          start_time: startTime,
          unit: 'minutes',
          duration: config.midtrans.expiredTime
        }
      };

      logger.info(`Creating Midtrans transaction with expired time: ${config.midtrans.expiredTime} minutes`);
      logger.info(`Start time formatted: ${startTime}`);
      logger.info('Creating Midtrans transaction with parameter:', JSON.stringify(parameter, null, 2));
      
      const transaction = await snap.createTransaction(parameter);
      
      logger.info('Midtrans transaction created successfully:', JSON.stringify(transaction, null, 2));
      
      return transaction;
    } catch (error) {
      logger.error('Midtrans create transaction error details:', {
        message: error.message,
        response: error.ApiResponse,
        httpStatusCode: error.httpStatusCode,
        rawHttpClientData: {
          status: error.rawHttpClientData?.status,
          statusText: error.rawHttpClientData?.statusText,
          data: error.rawHttpClientData?.data
        }
      });
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
      logger.error('Midtrans get status error:', error);
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
      logger.error('Midtrans cancel transaction error:', error);
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
      logger.error('Midtrans expire transaction error:', error);
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
      logger.error('Midtrans refund transaction error:', error);
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
      // Handle specific 404 error from Midtrans
      if (error.httpStatusCode === '404' || 
          (error.ApiResponse && error.ApiResponse.status_code === '404') ||
          (error.message && error.message.includes("Transaction doesn't exist"))) {
        
        logger.warn('Midtrans transaction not found (404):', {
          message: error.message,
          statusCode: error.httpStatusCode,
          apiResponse: error.ApiResponse
        });
        
        // Re-throw the original error so controller can handle it specifically
        throw error;
      }
      
      // Log error dengan data yang aman (tanpa circular reference)
      const safeErrorData = {
        message: error.message,
        httpStatusCode: error.httpStatusCode,
        apiResponse: error.ApiResponse,
        stack: error.stack
      };
      
      logger.error('Midtrans notification error:', safeErrorData);
      
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