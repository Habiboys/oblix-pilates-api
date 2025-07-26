const Joi = require('joi');

// Validation schema for creating booking
const createBookingSchema = Joi.object({
  schedule_id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'schedule_id harus berupa UUID yang valid',
      'any.required': 'schedule_id harus diisi'
    }),
  member_id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'member_id harus berupa UUID yang valid',
      'any.required': 'member_id harus diisi'
    }),
  package_id: Joi.string()
    .uuid()
    .optional()
    .messages({
      'string.guid': 'package_id harus berupa UUID yang valid'
    }),
  notes: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'notes maksimal 500 karakter'
    })
});

// Validation schema for updating booking status
const updateBookingStatusSchema = Joi.object({
  status: Joi.string()
    .valid('signup', 'waiting_list', 'cancelled')
    .optional()
    .messages({
      'any.only': 'status harus berupa signup, waiting_list, atau cancelled'
    }),
  notes: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'notes maksimal 500 karakter'
    })
});

module.exports = {
  createBookingSchema,
  updateBookingStatusSchema
}; 