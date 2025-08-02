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

module.exports = router; 