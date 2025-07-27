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

// Validation schema for updating attendance
const updateAttendanceSchema = Joi.object({
  attendance: Joi.string()
    .valid('present', 'absent')
    .required()
    .messages({
      'any.only': 'attendance harus berupa present atau absent',
      'any.required': 'attendance harus diisi'
    }),
  notes: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'notes maksimal 500 karakter'
    })
});

// Validation schema for admin cancel booking
const adminCancelBookingSchema = Joi.object({
  reason: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'reason maksimal 500 karakter'
    })
});

// Validation schema for updating schedule attendance
const updateScheduleAttendanceSchema = Joi.object({
  attendances: Joi.array().items(
    Joi.object({
      booking_id: Joi.string()
        .uuid()
        .required()
        .messages({
          'string.guid': 'booking_id harus berupa UUID yang valid',
          'any.required': 'booking_id harus diisi'
        }),
      attendance: Joi.string()
        .valid('present', 'absent')
        .required()
        .messages({
          'any.only': 'attendance harus berupa present atau absent',
          'any.required': 'attendance harus diisi'
        }),
      notes: Joi.string()
        .max(500)
        .optional()
        .messages({
          'string.max': 'notes maksimal 500 karakter'
        })
    })
  ).min(1).required().messages({
    'array.min': 'attendances harus berisi minimal 1 item',
    'any.required': 'attendances harus diisi'
  })
});

module.exports = {
  createBookingSchema,
  updateBookingStatusSchema,
  updateAttendanceSchema,
  adminCancelBookingSchema,
  updateScheduleAttendanceSchema
}; 