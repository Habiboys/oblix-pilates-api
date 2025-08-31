const Joi = require('joi');

// Validation schema for creating promo package
const createPromoPackageSchema = Joi.object({
  name: Joi.string()
    .min(3)
    .max(100)
    .required()
    .messages({
      'string.min': 'Package name must be at least 3 characters long',
      'string.max': 'Package name cannot exceed 100 characters',
      'any.required': 'Package name is required'
    }),
  price: Joi.number()
    .positive()
    .precision(2)
    .required()
    .messages({
      'number.base': 'Price must be a number',
      'number.positive': 'Price must be positive',
      'number.precision': 'Price can have maximum 2 decimal places',
      'any.required': 'Price is required'
    }),
  duration_value: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.base': 'Duration value must be a number',
      'number.integer': 'Duration value must be an integer',
      'number.positive': 'Duration value must be positive',
      'any.required': 'Duration value is required'
    }),
  duration_unit: Joi.string()
    .valid('week', 'month')
    .required()
    .messages({
      'any.only': 'Duration unit must be either week or month',
      'any.required': 'Duration unit is required'
    }),
  reminder_day: Joi.number()
    .integer()
    .min(1)
    .max(365)
    .optional()
    .allow(null)
    .messages({
      'number.base': 'Reminder day must be a number',
      'number.integer': 'Reminder day must be an integer',
      'number.min': 'Reminder day must be at least 1',
      'number.max': 'Reminder day cannot exceed 365'
    }),
  reminder_session: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .allow(null)
    .messages({
      'number.base': 'Reminder session must be a number',
      'number.integer': 'Reminder session must be an integer',
      'number.min': 'Reminder session must be at least 1',
      'number.max': 'Reminder session cannot exceed 100'
    }),
  group_session: Joi.number()
    .integer()
    .min(0)
    .optional()
    .allow(null)
    .default(0)
    .messages({
      'number.base': 'Group session must be a number',
      'number.integer': 'Group session must be an integer',
      'number.min': 'Group session must be at least 0'
    }),
  private_session: Joi.number()
    .integer()
    .min(0)
    .optional()
    .allow(null)
    .default(0)
    .messages({
      'number.base': 'Private session must be a number',
      'number.integer': 'Private session must be an integer',
      'number.min': 'Private session must be at least 0'
    }),
  start_time: Joi.date()
    .iso()
    .required()
    .messages({
      'date.base': 'Start time must be a valid date',
      'date.format': 'Start time must be in ISO format',
      'any.required': 'Start time is required'
    }),
  end_time: Joi.date()
    .iso()
    .required()
    .messages({
      'date.base': 'End time must be a valid date',
      'date.format': 'End time must be in ISO format',
      'any.required': 'End time is required'
    })
}).custom((value, helpers) => {
  const { group_session, private_session } = value;
  
  // Pastikan minimal salah satu sesi diisi (tidak boleh keduanya 0)
  const groupCount = group_session || 0;
  const privateCount = private_session || 0;
  
  if (groupCount === 0 && privateCount === 0) {
    return helpers.error('any.invalid', { 
      message: 'Minimal salah satu jenis sesi harus diisi (group atau private)' 
    });
  }
  
  return value;
}, 'validate-session-count');

// Validation schema for updating promo package
const updatePromoPackageSchema = Joi.object({
  name: Joi.string()
    .min(3)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Package name must be at least 3 characters long',
      'string.max': 'Package name cannot exceed 100 characters'
    }),
  price: Joi.number()
    .positive()
    .precision(2)
    .optional()
    .messages({
      'number.base': 'Price must be a number',
      'number.positive': 'Price must be positive',
      'number.precision': 'Price can have maximum 2 decimal places'
    }),
  duration_value: Joi.number()
    .integer()
    .positive()
    .optional()
    .messages({
      'number.base': 'Duration value must be a number',
      'number.integer': 'Duration value must be an integer',
      'number.positive': 'Duration value must be positive'
    }),
  duration_unit: Joi.string()
    .valid('week', 'month')
    .optional()
    .messages({
      'any.only': 'Duration unit must be either week or month'
    }),
  reminder_day: Joi.number()
    .integer()
    .min(1)
    .max(365)
    .optional()
    .allow(null)
    .messages({
      'number.base': 'Reminder day must be a number',
      'number.integer': 'Reminder day must be an integer',
      'number.min': 'Reminder day must be at least 1',
      'number.max': 'Reminder day cannot exceed 365'
    }),
  reminder_session: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .allow(null)
    .messages({
      'number.base': 'Reminder session must be a number',
      'number.integer': 'Reminder session must be an integer',
      'number.min': 'Reminder session must be at least 1',
      'number.max': 'Reminder session cannot exceed 100'
    }),
  group_session: Joi.number()
    .integer()
    .min(0)
    .optional()
    .allow(null)
    .default(0)
    .messages({
      'number.base': 'Group session must be a number',
      'number.integer': 'Group session must be an integer',
      'number.min': 'Group session must be at least 0'
    }),
  private_session: Joi.number()
    .integer()
    .min(0)
    .optional()
    .allow(null)
    .default(0)
    .messages({
      'number.base': 'Private session must be a number',
      'number.integer': 'Private session must be an integer',
      'number.min': 'Private session must be at least 0'
    }),
  start_time: Joi.date()
    .iso()
    .optional()
    .messages({
      'date.base': 'Start time must be a valid date',
      'date.format': 'Start time must be in ISO format'
    }),
  end_time: Joi.date()
    .iso()
    .optional()
    .messages({
      'date.base': 'End time must be a valid date',
      'date.format': 'End time must be in ISO format'
    })
}).custom((value, helpers) => {
  const { group_session, private_session } = value;
  
  // Jika kedua field diisi, validasi minimal salah satu tidak 0
  if (group_session !== undefined && private_session !== undefined) {
    const groupCount = group_session || 0;
    const privateCount = private_session || 0;
    
    if (groupCount === 0 && privateCount === 0) {
      return helpers.error('any.invalid', { 
        message: 'Minimal salah satu jenis sesi harus diisi (group atau private)' 
      });
    }
  }
  
  return value;
}, 'validate-session-count-update');

// Validation schema for promo package ID parameter
const promoPackageIdSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Promo package ID must be a valid UUID',
      'any.required': 'Promo package ID is required'
    })
});

// Validation schema for query parameters
const promoPackageQuerySchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .optional()
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
    .optional()
    .default(10)
    .messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    }),
  search: Joi.string()
    .max(100)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Search term cannot exceed 100 characters'
    })
});

module.exports = {
  createPromoPackageSchema,
  updatePromoPackageSchema,
  promoPackageIdSchema,
  promoPackageQuerySchema
}; 