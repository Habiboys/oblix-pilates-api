const Joi = require('joi');

// Validation schema for creating trial package
const createTrialPackageSchema = Joi.object({
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
    .required()
    .messages({
      'number.base': 'Group session must be a number',
      'number.integer': 'Group session must be an integer',
      'number.min': 'Group session must be at least 0',
      'any.required': 'Group session is required'
    }),
  private_session: Joi.number()
    .integer()
    .min(0)
    .required()
    .messages({
      'number.base': 'Private session must be a number',
      'number.integer': 'Private session must be an integer',
      'number.min': 'Private session must be at least 0',
      'any.required': 'Private session is required'
    })
});

// Validation schema for updating trial package
const updateTrialPackageSchema = Joi.object({
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
    .messages({
      'number.base': 'Group session must be a number',
      'number.integer': 'Group session must be an integer',
      'number.min': 'Group session must be at least 0'
    }),
  private_session: Joi.number()
    .integer()
    .min(0)
    .optional()
    .messages({
      'number.base': 'Private session must be a number',
      'number.integer': 'Private session must be an integer',
      'number.min': 'Private session must be at least 0'
    })
});

// Validation schema for trial package ID parameter
const trialPackageIdSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Trial package ID must be a valid UUID',
      'any.required': 'Trial package ID is required'
    })
});

// Validation schema for query parameters
const trialPackageQuerySchema = Joi.object({
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
  createTrialPackageSchema,
  updateTrialPackageSchema,
  trialPackageIdSchema,
  trialPackageQuerySchema
}; 