const Joi = require('joi');

// Validation schema for creating order
const createOrderSchema = Joi.object({
  package_id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Package ID must be a valid UUID',
      'any.required': 'Package ID is required'
    })
});

// Validation schema for checking payment status
const checkPaymentStatusSchema = Joi.object({
  order_id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Order ID must be a valid UUID',
      'any.required': 'Order ID is required'
    })
});

// Validation schema for cancelling order
const cancelOrderSchema = Joi.object({
  order_id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Order ID must be a valid UUID',
      'any.required': 'Order ID is required'
    })
});

// Validation schema for getting user orders
const getUserOrdersSchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.base': 'Page must be a number',
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1'
    }),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10)
    .messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    }),
  status: Joi.string()
    .valid('pending', 'paid', 'failed', 'expired', 'cancelled')
    .optional()
    .messages({
      'any.only': 'Status must be one of: pending, paid, failed, expired, cancelled'
    })
});

// Validation schema for getting order by ID
const getOrderByIdSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Order ID must be a valid UUID',
      'any.required': 'Order ID is required'
    })
});

// Validation schema for payment notification
const paymentNotificationSchema = Joi.object({
  transaction_status: Joi.string()
    .required()
    .messages({
      'any.required': 'Transaction status is required'
    }),
  order_id: Joi.string()
    .required()
    .messages({
      'any.required': 'Order ID is required'
    }),
  transaction_id: Joi.string()
    .optional()
    .messages({
      'string.base': 'Transaction ID must be a string'
    }),
  fraud_status: Joi.string()
    .optional()
    .messages({
      'string.base': 'Fraud status must be a string'
    }),
  payment_type: Joi.string()
    .optional()
    .messages({
      'string.base': 'Payment type must be a string'
    }),
  va_numbers: Joi.array()
    .items(Joi.object({
      bank: Joi.string().required(),
      va_number: Joi.string().required()
    }))
    .optional()
    .messages({
      'array.base': 'VA numbers must be an array'
    }),
  pdf_url: Joi.string()
    .uri()
    .optional()
    .messages({
      'string.uri': 'PDF URL must be a valid URL'
    })
});

// Validation schema for payment callbacks
const paymentCallbackSchema = Joi.object({
  order_id: Joi.string()
    .required()
    .messages({
      'any.required': 'Order ID is required'
    }),
  result_code: Joi.string()
    .optional()
    .messages({
      'string.base': 'Result code must be a string'
    }),
  transaction_status: Joi.string()
    .optional()
    .messages({
      'string.base': 'Transaction status must be a string'
    })
});

module.exports = {
  createOrderSchema,
  checkPaymentStatusSchema,
  cancelOrderSchema,
  getUserOrdersSchema,
  getOrderByIdSchema,
  paymentNotificationSchema,
  paymentCallbackSchema
}; 