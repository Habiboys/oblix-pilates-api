const Joi = require('joi');

// Validation schema for creating bonus package
const createBonusPackageSchema = Joi.object({
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
  member_id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Member ID must be a valid UUID',
      'any.required': 'Member ID is required'
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

// Validation schema for updating bonus package
const updateBonusPackageSchema = Joi.object({
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