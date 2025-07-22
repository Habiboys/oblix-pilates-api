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
router.get('/my-orders', validateToken, validate(getUserOrdersSchema, 'query'), orderController.getUserOrders);
router.get('/:id', validateToken, validate(getOrderByIdSchema, 'params'), orderController.getOrderById);
router.get('/:order_id/status', validateToken, validate(checkPaymentStatusSchema, 'params'), orderController.checkPaymentStatus);
router.delete('/:order_id/cancel', validateToken, validate(cancelOrderSchema, 'params'), orderController.cancelOrder);

// Payment callback routes (no authentication required)
router.post('/payment/notification', validate(paymentNotificationSchema), orderController.paymentNotification);
router.get('/payment/finish', validate(paymentCallbackSchema, 'query'), orderController.paymentFinish);
router.get('/payment/error', validate(paymentCallbackSchema, 'query'), orderController.paymentError);
router.get('/payment/pending', validate(paymentCallbackSchema, 'query'), orderController.paymentPending);

module.exports = router; 