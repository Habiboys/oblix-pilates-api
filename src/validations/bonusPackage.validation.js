const Joi = require('joi');

// Validation schema for creating bonus package
const createBonusPackageSchema = Joi.object({
  // Optional fields that might be sent from frontend
  name: Joi.string().optional().allow(''),
  price: Joi.string().optional().allow(''),
  reminder_day: Joi.string().optional().allow(''),
  reminder_session: Joi.string().optional().allow(''),
  category_id: Joi.string().optional().allow(''),
  
  // Required fields
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
    }),
  member_id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Member ID must be a valid UUID',
      'any.required': 'Member ID is required'
    })
});

// Validation schema for updating bonus package
const updateBonusPackageSchema = Joi.object({
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

 
  member_id: Joi.string()
    .uuid()
    .optional()
    .messages({
      'string.guid': 'Member ID must be a valid UUID'
    })
});

// Validation schema for bonus package ID parameter
const bonusPackageIdSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Bonus package ID must be a valid UUID',
      'any.required': 'Bonus package ID is required'
    })
});

// Validation schema for query parameters
const bonusPackageQuerySchema = Joi.object({
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

// Validation schema for member search query parameters
const memberSearchQuerySchema = Joi.object({
  search: Joi.string()
    .max(100)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Search term cannot exceed 100 characters'
    })
});

module.exports = {
  createBonusPackageSchema,
  updateBonusPackageSchema,
  bonusPackageIdSchema,
  bonusPackageQuerySchema,
  memberSearchQuerySchema
}; 