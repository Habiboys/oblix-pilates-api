const Joi = require('joi');

// Validation schema for check class query parameters
const checkClassQuerySchema = Joi.object({
  date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required()
    .messages({
      'string.pattern.base': 'Date must be in YYYY-MM-DD format',
      'any.required': 'Date parameter is required'
    })
});

module.exports = {
  checkClassQuerySchema
}; 