const Joi = require('joi');

// Schema untuk create booking (admin)
const createBookingSchema = Joi.object({
    schedule_id: Joi.string().uuid().required().messages({
        'string.empty': 'Schedule ID is required',
        'string.uuid': 'Schedule ID must be a valid UUID',
        'any.required': 'Schedule ID is required'
    }),
    member_id: Joi.string().uuid().required().messages({
        'string.empty': 'Member ID is required',
        'string.uuid': 'Member ID must be a valid UUID',
        'any.required': 'Member ID is required'
    }),
    package_id: Joi.string().uuid().optional().messages({
        'string.uuid': 'Package ID must be a valid UUID'
    }),
    notes: Joi.string().max(500).optional().messages({
        'string.max': 'Notes cannot exceed 500 characters'
    })
});

// Schema untuk create user booking
const createUserBookingSchema = Joi.object({
    schedule_id: Joi.string().uuid().required().messages({
        'string.empty': 'Schedule ID is required',
        'string.uuid': 'Schedule ID must be a valid UUID',
        'any.required': 'Schedule ID is required'
    }),
    package_id: Joi.string().uuid().optional().messages({
        'string.uuid': 'Package ID must be a valid UUID'
    }),
    notes: Joi.string().max(500).optional().messages({
        'string.max': 'Notes cannot exceed 500 characters'
    })
});

// Schema untuk update booking status
const updateBookingStatusSchema = Joi.object({
    status: Joi.string().valid('signup', 'waiting_list', 'cancelled').required().messages({
        'string.empty': 'Status is required',
        'any.only': 'Status must be one of: signup, waiting_list, cancelled',
        'any.required': 'Status is required'
    }),
    notes: Joi.string().max(500).optional().messages({
        'string.max': 'Notes cannot exceed 500 characters'
    })
});

// Schema untuk cancel booking
const cancelBookingSchema = Joi.object({
    reason: Joi.string().max(500).optional().messages({
        'string.max': 'Reason cannot exceed 500 characters'
    })
});

// Schema untuk cancel user booking
const cancelUserBookingSchema = Joi.object({
    reason: Joi.string().max(500).optional().messages({
        'string.max': 'Reason cannot exceed 500 characters'
    })
});

// Schema untuk update attendance
const updateAttendanceSchema = Joi.object({
    attendance: Joi.string().valid('present', 'absent', 'late').required().messages({
        'string.empty': 'Attendance is required',
        'any.only': 'Attendance must be one of: present, absent, late',
        'any.required': 'Attendance is required'
    }),
    notes: Joi.string().max(500).optional().messages({
        'string.max': 'Notes cannot exceed 500 characters'
    })
});

// Schema untuk update schedule attendance (bulk)
const updateScheduleAttendanceSchema = Joi.object({
    attendances: Joi.array().items(
        Joi.object({
            booking_id: Joi.string().uuid().required().messages({
                'string.empty': 'Booking ID is required',
                'string.uuid': 'Booking ID must be a valid UUID',
                'any.required': 'Booking ID is required'
            }),
            attendance: Joi.string().valid('present', 'absent', 'late').required().messages({
                'string.empty': 'Attendance is required',
                'any.only': 'Attendance must be one of: present, absent, late',
                'any.required': 'Attendance is required'
            }),
            notes: Joi.string().max(500).optional().messages({
                'string.max': 'Notes cannot exceed 500 characters'
            })
        })
    ).min(1).required().messages({
        'array.min': 'At least one attendance record is required',
        'any.required': 'Attendances array is required'
    })
});

// Schema untuk admin cancel booking
const adminCancelBookingSchema = Joi.object({
    reason: Joi.string().max(500).optional().messages({
        'string.max': 'Reason cannot exceed 500 characters'
    })
});

module.exports = {
    createBookingSchema,
    createUserBookingSchema,
    updateBookingStatusSchema,
    cancelBookingSchema,
    cancelUserBookingSchema,
    updateAttendanceSchema,
    updateScheduleAttendanceSchema,
    adminCancelBookingSchema
}; 