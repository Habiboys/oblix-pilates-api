const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { validate  } = require('../middlewares/validation.middleware');
const { validateToken} = require('../middlewares/auth.middleware');
const {
  createOrderSchema,
  checkPaymentStatusSchema,
  cancelOrderSchema,
  getUserOrdersSchema,
  getOrderByIdSchema,
  paymentNotificationSchema,
  paymentCallbackSchema
} = require('../validations/order.validation');

// Order management routes (require authentication)
router.post('/create', validateToken, validate(createOrderSchema), orderController.createOrder);
router.get('/my-orders', validateToken, validate(getUserOrdersSchema, 'query'), orderController.getMyOrders);
router.get('/my-orders/:id', validateToken, validate(getOrderByIdSchema, 'params'), orderController.getMyOrderById);
router.get('/:id', validateToken, validate(getOrderByIdSchema, 'params'), orderController.getOrderById);
router.delete('/:order_id/cancel', validateToken, validate(cancelOrderSchema, 'params'), orderController.cancelOrder);

// Pending order payment redirect
router.get('/pending/:order_id/details', validateToken, orderController.getPendingOrderDetails);

// Payment callback routes (no authentication required)
router.post('/payment/notification', validate(paymentNotificationSchema), orderController.paymentNotification);
router.get('/payment/finish', orderController.paymentFinish);
router.get('/payment/error', orderController.paymentError);
router.get('/payment/pending', orderController.paymentPending);

// Custom fast redirect handler for Midtrans
router.get('/payment/redirect', async (req, res) => {
  try {
    const { order_id, transaction_status, status_code } = req.query;
    
    console.log('🚀 Fast redirect handler:', { order_id, transaction_status });
    
    // Redirect immediately without any processing
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = `${frontendUrl}/my-orders`;
    
    console.log('🔄 Redirecting immediately to:', redirectUrl);
    res.redirect(redirectUrl);
    
    // Process order update in background (completely non-blocking)
    setImmediate(async () => {
      try {
        console.log('🔄 Background processing order:', order_id);
        
        const { Order } = require('../models');
        
        // Find order
        const order = await Order.findOne({
          where: { order_number: order_id }
        }).timeout(5000);
        
        if (!order) {
          console.log(`❌ Order not found: ${order_id}`);
          return;
        }
        
        // Update based on transaction status
        if (transaction_status === 'expire') {
          await order.update({
            status: 'cancelled',
            payment_status: 'expired',
            cancelled_at: new Date(),
            cancelled_by: 'system',
            cancel_reason: 'Payment expired via Midtrans redirect'
          });
          console.log(`✅ Order ${order_id} marked as expired`);
        } else if (transaction_status === 'pending') {
          // Check if phantom order
          if (!order.midtrans_transaction_id) {
            await order.update({
              status: 'cancelled',
              payment_status: 'cancelled',
              cancelled_at: new Date(),
              cancelled_by: 'system',
              cancel_reason: 'Phantom order - never created in Midtrans'
            });
            console.log(`✅ Phantom order ${order_id} cancelled`);
          }
        }
      } catch (error) {
        console.error('❌ Background processing error:', error);
      }
    });
    
  } catch (error) {
    console.error('❌ Redirect handler error:', error);
    // Even if error, still redirect
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/my-orders`);
  }
});



module.exports = router; 