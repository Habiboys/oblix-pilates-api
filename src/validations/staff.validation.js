const Joi = require('joi');

// Validation schema for creating staff
const createStaffSchema = Joi.object({
  full_name: Joi.string()
    .min(2)
    .max(150)
    .required()
    .messages({
      'string.min': 'Full name must be at least 2 characters long',
      'string.max': 'Full name cannot exceed 150 characters',
      'any.required': 'Full name is required'
    }),
  username: Joi.string()
    .min(3)
    .max(50)
    .pattern(/^[a-zA-Z0-9_]+$/)
    .required()
    .messages({
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username cannot exceed 50 characters',
      'string.pattern.base': 'Username can only contain letters, numbers, and underscores',
      'any.required': 'Username is required'
    }),
  email: Joi.string()
    .email()
    .max(255)
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.max': 'Email cannot exceed 255 characters',
      'any.required': 'Email is required'
    }),
  date_of_birth: Joi.date()
    .max('now')
    .required()
    .messages({
      'date.base': 'Date of birth must be a valid date',
      'date.max': 'Date of birth cannot be in the future',
      'any.required': 'Date of birth is required'
    }),
  phone_number: Joi.string()
    .pattern(/^[0-9+\-\s()]+$/)
    .min(10)
    .max(50)
    .required()
    .messages({
      'string.pattern.base': 'Phone number can only contain numbers, spaces, hyphens, parentheses, and plus signs',
      'string.min': 'Phone number must be at least 10 characters long',
      'string.max': 'Phone number cannot exceed 50 characters',
      'any.required': 'Phone number is required'
    }),
  password: Joi.string()
    .min(6)
    .max(255)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters long',
      'string.max': 'Password cannot exceed 255 characters',
      'any.required': 'Password is required'
    })
});

// Validation schema for updating staff
const updateStaffSchema = Joi.object({
  full_name: Joi.string()
    .min(2)
    .max(150)
    .optional()
    .messages({
      'string.min': 'Full name must be at least 2 characters long',
      'string.max': 'Full name cannot exceed 150 characters'
    }),
  username: Joi.string()
    .min(3)
    .max(50)
    .pattern(/^[a-zA-Z0-9_]+$/)
    .optional()
    .messages({
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username cannot exceed 50 characters',
      'string.pattern.base': 'Username can only contain letters, numbers, and underscores'
    }),
  email: Joi.string()
    .email()
    .max(255)
    .optional()
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.max': 'Email cannot exceed 255 characters'
    }),
  date_of_birth: Joi.date()
    .max('now')
    .optional()
    .messages({
      'date.base': 'Date of birth must be a valid date',
      'date.max': 'Date of birth cannot be in the future'
    }),
  phone_number: Joi.string()
    .pattern(/^[0-9+\-\s()]+$/)
    .min(10)
    .max(50)
    .optional()
    .messages({
      'string.pattern.base': 'Phone number can only contain numbers, spaces, hyphens, parentheses, and plus signs',
      'string.min': 'Phone number must be at least 10 characters long',
      'string.max': 'Phone number cannot exceed 50 characters'
    }),
  password: Joi.string()
    .min(6)
    .max(255)
    .optional()
    .messages({
      'string.min': 'Password must be at least 6 characters long',
      'string.max': 'Password cannot exceed 255 characters'
    })
});

// Validation schema for staff ID parameter
const staffIdSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Staff ID must be a valid UUID',
      'any.required': 'Staff ID is required'
    })
});

// Validation schema for query parameters
const staffQuerySchema = Joi.object({
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
  createStaffSchema,
  updateStaffSchema,
  staffIdSchema,
  staffQuerySchema
}; 