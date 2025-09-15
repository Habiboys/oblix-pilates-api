const Joi = require('joi');

const createGroupScheduleSchema = Joi.object({
    class_id: Joi.string().uuid().required().messages({
        'string.uuid': 'Class ID must be a valid UUID',
        'any.required': 'Class ID is required'
    }),
    trainer_id: Joi.string().uuid().required().messages({
        'string.empty': 'Trainer ID is required',
        'string.uuid': 'Trainer ID must be a valid UUID',
        'any.required': 'Trainer ID is required'
    }),
    level: Joi.string().valid('Basic', 'Flow').required().messages({
        'any.only': 'Level must be either Basic or Flow',
        'any.required': 'Level is required'
    }),
    pax: Joi.number().integer().min(1).max(50).required().messages({
        'number.base': 'Pax must be a number',
        'number.integer': 'Pax must be an integer',
        'number.min': 'Pax must be at least 1',
        'number.max': 'Pax cannot exceed 50',
        'any.required': 'Pax is required'
    }),
    date_start: Joi.date().iso().required().messages({
        'date.base': 'Date start must be a valid date',
        'date.format': 'Date start must be in ISO format (YYYY-MM-DD)',
        'any.required': 'Date start is required'
    }),
    time_start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
        'string.empty': 'Time start is required',
        'string.pattern.base': 'Time start must be in HH:MM format',
        'any.required': 'Time start is required'
    }),
    time_end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
        'string.empty': 'Time end is required',
        'string.pattern.base': 'Time end must be in HH:MM format',
        'any.required': 'Time end is required'
    }),
    repeat_type: Joi.string().valid('none', 'weekly').default('none').messages({
        'string.empty': 'Repeat type is required',
        'any.only': 'Repeat type must be either "none" or "weekly"'
    }),
    repeat_days: Joi.when('repeat_type', {
        is: 'weekly',
        then: Joi.array().items(Joi.number().integer().min(0).max(6)).min(1).max(7).required().messages({
            'array.base': 'Repeat days must be an array',
            'array.min': 'At least one day must be selected for weekly repeat',
            'array.max': 'Maximum 7 days can be selected',
            'any.required': 'Repeat days is required for weekly repeat'
        }),
        otherwise: Joi.array().items(Joi.number().integer().min(0).max(6)).optional()
    }),
    schedule_until: Joi.alternatives().try(
        Joi.date().iso(),
        Joi.string().allow('', null),
        Joi.allow(null)
    ).optional().messages({
            'date.base': 'Schedule until must be a valid date',
        'date.format': 'Schedule until must be in ISO format (YYYY-MM-DD)'
    }),
    booking_deadline_hour: Joi.number().integer().min(0).max(72).required().messages({
        'number.base': 'Booking deadline hour must be a number',
        'number.integer': 'Booking deadline hour must be an integer',
        'number.min': 'Booking deadline hour must be at least 0',
        'number.max': 'Booking deadline hour cannot exceed 72',
        'any.required': 'Booking deadline hour is required'
    }),

    min_signup: Joi.number().integer().min(1).required().messages({
        'number.base': 'Minimum signup must be a number',
        'number.integer': 'Minimum signup must be an integer',
        'number.min': 'Minimum signup must be at least 1',
        'any.required': 'Minimum signup is required'
    }),
    cancel_buffer_minutes: Joi.number().integer().min(0).max(480).required().messages({
        'number.base': 'Cancel buffer minutes must be a number',
        'number.integer': 'Cancel buffer minutes must be an integer',
        'number.min': 'Cancel buffer minutes must be at least 0',
        'number.max': 'Cancel buffer minutes cannot exceed 480',
        'any.required': 'Cancel buffer minutes is required'
    })
});

const updateGroupScheduleSchema = Joi.object({
    class_id: Joi.string().uuid().optional().messages({
        'string.uuid': 'Class ID must be a valid UUID'
    }),
    trainer_id: Joi.string().uuid().optional().messages({
        'string.uuid': 'Trainer ID must be a valid UUID'
    }),
    level: Joi.string().valid('Basic', 'Flow').optional().messages({
        'any.only': 'Level must be either Basic or Flow'
    }),
    pax: Joi.number().integer().min(1).max(50).optional().messages({
        'number.base': 'Pax must be a number',
        'number.integer': 'Pax must be an integer',
        'number.min': 'Pax must be at least 1',
        'number.max': 'Pax cannot exceed 50'
    }),
    date_start: Joi.date().iso().optional().messages({
        'date.base': 'Date start must be a valid date',
        'date.format': 'Date start must be in ISO format (YYYY-MM-DD)'
    }),
    time_start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().messages({
        'string.pattern.base': 'Time start must be in HH:MM format'
    }),
    time_end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().messages({
        'string.pattern.base': 'Time end must be in HH:MM format'
    }),
    repeat_type: Joi.string().valid('none', 'weekly').optional().messages({
        'any.only': 'Repeat type must be either "none" or "weekly"'
    }),
    repeat_days: Joi.array().items(Joi.number().integer().min(0).max(6)).optional().messages({
        'array.base': 'Repeat days must be an array',
        'array.min': 'At least one day must be selected for weekly repeat',
        'array.max': 'Maximum 7 days can be selected'
    }),
    schedule_until: Joi.alternatives().try(
        Joi.date().iso(),
        Joi.string().allow('', null),
        Joi.allow(null)
    ).optional().messages({
        'date.base': 'Schedule until must be a valid date',
        'date.format': 'Schedule until must be in ISO format (YYYY-MM-DD)'
    }),
    booking_deadline_hour: Joi.number().integer().min(0).max(72).optional().messages({
        'number.base': 'Booking deadline hour must be a number',
        'number.integer': 'Booking deadline hour must be an integer',
        'number.min': 'Booking deadline hour must be at least 0',
        'number.max': 'Booking deadline hour cannot exceed 72'
    }),

    min_signup: Joi.number().integer().min(1).optional().messages({
        'number.base': 'Minimum signup must be a number',
        'number.integer': 'Minimum signup must be an integer',
        'number.min': 'Minimum signup must be at least 1'
    }),
    cancel_buffer_minutes: Joi.number().integer().min(0).max(480).optional().messages({
        'number.base': 'Cancel buffer minutes must be a number',
        'number.integer': 'Cancel buffer minutes must be an integer',
        'number.min': 'Cancel buffer minutes must be at least 0',
        'number.max': 'Cancel buffer minutes cannot exceed 480'
    })
});

// Validation schema for getting group schedules
const getGroupScheduleSchema = Joi.object({
    page: Joi.number().integer().min(1).optional().default(1).messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1'
    }),
    limit: Joi.number().integer().min(1).max(100).optional().default(10).messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
    }),
    search: Joi.string().optional().allow('').messages({
        'string.base': 'Search must be a string'
    }),
    date: Joi.date().iso().optional().messages({
        'date.base': 'Date must be a valid date',
        'date.format': 'Date must be in ISO format (YYYY-MM-DD)'
    })
});

// Validation schema for semi-private schedule creation
const createSemiPrivateScheduleSchema = Joi.object({
    class_id: Joi.string().uuid().optional().messages({
        'string.uuid': 'Class ID must be a valid UUID'
    }),
    trainer_id: Joi.string().uuid().required().messages({
        'string.uuid': 'Trainer ID must be a valid UUID',
        'any.required': 'Trainer ID is required'
    }),
    level: Joi.string().valid('Basic', 'Flow').required().messages({
        'any.only': 'Level must be either Basic or Flow',
        'any.required': 'Level is required'
    }),
    // pax removed - default to 2 for semi-private schedules
    date_start: Joi.date().iso().min(new Date().toISOString().split('T')[0]).required().messages({
        'date.base': 'Date start must be a valid date',
        'date.format': 'Date start must be in ISO format (YYYY-MM-DD)',
        'date.min': 'Date start cannot be in the past',
        'any.required': 'Date start is required'
    }),
    time_start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
        'string.pattern.base': 'Time start must be in HH:MM format (24-hour)',
        'any.required': 'Time start is required'
    }),
    time_end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
        'string.pattern.base': 'Time end must be in HH:MM format (24-hour)',
        'any.required': 'Time end is required'
    }),
    repeat_type: Joi.string().valid('none', 'weekly').default('none').messages({
        'any.only': 'Repeat type must be either "none" or "weekly"'
    }),
    repeat_days: Joi.when('repeat_type', {
        is: 'weekly',
        then: Joi.array().items(Joi.number().integer().min(0).max(6)).min(1).max(7).required().messages({
            'array.base': 'Repeat days must be an array',
            'array.min': 'At least one day must be selected for weekly repeat',
            'array.max': 'Maximum 7 days can be selected',
            'any.required': 'Repeat days is required for weekly repeat'
        }),
        otherwise: Joi.array().items(Joi.number().integer().min(0).max(6)).optional()
    }),
    schedule_until: Joi.alternatives().try(
        Joi.date().iso(),
        Joi.string().allow('', null),
        Joi.allow(null)
    ).optional().messages({
            'date.base': 'Schedule until must be a valid date',
        'date.format': 'Schedule until must be in ISO format (YYYY-MM-DD)'
    }),
    booking_deadline_hour: Joi.number().integer().min(1).max(72).required().messages({
        'number.base': 'Booking deadline hour must be a number',
        'number.integer': 'Booking deadline hour must be an integer',
        'number.min': 'Booking deadline hour must be at least 1',
        'number.max': 'Booking deadline hour cannot exceed 72',
        'any.required': 'Booking deadline hour is required'
    }),

    min_signup: Joi.number().integer().min(1).max(2).required().messages({
        'number.base': 'Minimum signup must be a number',
        'number.integer': 'Minimum signup must be an integer',
        'number.min': 'Minimum signup must be at least 1',
        'number.max': 'Minimum signup cannot exceed 2 (semi-private pax is fixed at 2)',
        'any.required': 'Minimum signup is required'
    }),
    cancel_buffer_minutes: Joi.number().integer().min(0).max(1440).required().messages({
        'number.base': 'Cancel buffer minutes must be a number',
        'number.integer': 'Cancel buffer minutes must be an integer',
        'number.min': 'Cancel buffer minutes must be at least 0',
        'number.max': 'Cancel buffer minutes cannot exceed 1440',
        'any.required': 'Cancel buffer minutes is required'
    })
}).custom((value, helpers) => {
    // Custom validation for time_end > time_start
    if (value.time_start && value.time_end) {
        const startTime = new Date(`2000-01-01T${value.time_start}`);
        const endTime = new Date(`2000-01-01T${value.time_end}`);
        
        if (endTime <= startTime) {
            return helpers.error('any.invalid', { message: 'Time end must be after time start' });
        }
    }
    
    // Custom validation for schedule_until > date_start when repeat_type is weekly
    if (value.repeat_type === 'weekly' && value.date_start && value.schedule_until) {
        const startDate = new Date(value.date_start);
        const untilDate = new Date(value.schedule_until);
        
        if (untilDate <= startDate) {
            return helpers.error('any.invalid', { message: 'Schedule until date must be after date start' });
        }
    }
    
    
    
    // Custom validation for booking_deadline_hour > cancel_buffer_minutes
    if (value.booking_deadline_hour && value.cancel_buffer_minutes) {
        const deadlineHours = value.booking_deadline_hour;
        const bufferHours = value.cancel_buffer_minutes / 60; // Convert minutes to hours
        
        if (deadlineHours <= bufferHours) {
            return helpers.error('any.invalid', { message: 'Booking deadline hour must be greater than cancel buffer time' });
        }
    }
    
    return value;
});

// Validation schema for semi-private schedule update
const updateSemiPrivateScheduleSchema = Joi.object({
    class_id: Joi.string().uuid().optional().messages({
        'string.uuid': 'Class ID must be a valid UUID'
    }),
    trainer_id: Joi.string().uuid().optional().messages({
        'string.uuid': 'Trainer ID must be a valid UUID'
    }),
    level: Joi.string().valid('Basic', 'Flow').optional().messages({
        'any.only': 'Level must be either Basic or Flow'
    }),
    // pax removed - fixed at 2 for semi-private schedules, cannot be updated
    date_start: Joi.date().iso().optional().messages({
        'date.base': 'Date start must be a valid date',
        'date.format': 'Date start must be in ISO format (YYYY-MM-DD)'
    }),
    time_start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().messages({
        'string.pattern.base': 'Time start must be in HH:MM format (24-hour)'
    }),
    time_end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().messages({
        'string.pattern.base': 'Time end must be in HH:MM format (24-hour)'
    }),
    repeat_type: Joi.string().valid('none', 'weekly').optional().messages({
        'any.only': 'Repeat type must be either "none" or "weekly"'
    }),
    schedule_until: Joi.alternatives().try(
        Joi.date().iso(),
        Joi.string().allow('', null),
        Joi.allow(null)
    ).optional().messages({
            'date.base': 'Schedule until must be a valid date',
        'date.format': 'Schedule until must be in ISO format (YYYY-MM-DD)'
    }),
    booking_deadline_hour: Joi.number().integer().min(1).max(72).optional().messages({
        'number.base': 'Booking deadline hour must be a number',
        'number.integer': 'Booking deadline hour must be an integer',
        'number.min': 'Booking deadline hour must be at least 1',
        'number.max': 'Booking deadline hour cannot exceed 72'
    }),

    min_signup: Joi.number().integer().min(1).max(2).optional().messages({
        'number.base': 'Minimum signup must be a number',
        'number.integer': 'Minimum signup must be an integer',
        'number.min': 'Minimum signup must be at least 1',
        'number.max': 'Minimum signup cannot exceed 2 (semi-private pax is fixed at 2)'
    }),
    cancel_buffer_minutes: Joi.number().integer().min(0).max(1440).optional().messages({
        'number.base': 'Cancel buffer minutes must be a number',
        'number.integer': 'Cancel buffer minutes must be an integer',
        'number.min': 'Cancel buffer minutes must be at least 0',
        'number.max': 'Cancel buffer minutes cannot exceed 1440'
    })
});

// Validation schema for getting semi-private schedules
const getSemiPrivateScheduleSchema = Joi.object({
    page: Joi.number().integer().min(1).optional().default(1).messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1'
    }),
    limit: Joi.number().integer().min(1).max(100).optional().default(10).messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
    }),
    search: Joi.string().optional().allow('').messages({
        'string.base': 'Search must be a string'
    }),
    date: Joi.date().iso().optional().messages({
        'date.base': 'Date must be a valid date',
        'date.format': 'Date must be in ISO format (YYYY-MM-DD)'
    })
});

// Validation schema for private schedule creation
const createPrivateScheduleSchema = Joi.object({
    class_id: Joi.string().uuid().required().messages({
        'string.uuid': 'Class ID must be a valid UUID',
        'any.required': 'Class ID is required'
    }),
    trainer_id: Joi.string().uuid().required().messages({
        'string.uuid': 'Trainer ID must be a valid UUID',
        'any.required': 'Trainer ID is required'
    }),
    level: Joi.string().valid('Basic', 'Flow').required().messages({
        'any.only': 'Level must be either Basic or Flow',
        'any.required': 'Level is required'
    }),
    member_id: Joi.string().uuid().required().messages({
        'string.uuid': 'Member ID must be a valid UUID',
        'any.required': 'Member ID is required'
    }),
    date_start: Joi.date().iso().min(new Date().toISOString().split('T')[0]).required().messages({
        'date.base': 'Date start must be a valid date',
        'date.format': 'Date start must be in ISO format (YYYY-MM-DD)',
        'date.min': 'Date start cannot be in the past',
        'any.required': 'Date start is required'
    }),
    time_start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
        'string.pattern.base': 'Time start must be in HH:MM format (24-hour)',
        'any.required': 'Time start is required'
    }),
    time_end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
        'string.pattern.base': 'Time end must be in HH:MM format (24-hour)',
        'any.required': 'Time end is required'
    }),
    repeat_type: Joi.string().valid('none', 'weekly').default('none').messages({
        'any.only': 'Repeat type must be either "none" or "weekly"'
    }),
    repeat_days: Joi.when('repeat_type', {
        is: 'weekly',
        then: Joi.array().items(Joi.number().integer().min(0).max(6)).min(1).max(7).required().messages({
            'array.base': 'Repeat days must be an array',
            'array.min': 'At least one day must be selected for weekly repeat',
            'array.max': 'Maximum 7 days can be selected',
            'any.required': 'Repeat days is required for weekly repeat'
        }),
        otherwise: Joi.array().items(Joi.number().integer().min(0).max(6)).optional()
    }),
    schedule_until: Joi.alternatives().try(
        Joi.date().iso(),
        Joi.string().allow('', null),
        Joi.allow(null)
    ).optional().messages({
            'date.base': 'Schedule until must be a valid date',
        'date.format': 'Schedule until must be in ISO format (YYYY-MM-DD)'
    }),
    booking_deadline_hour: Joi.number().integer().min(1).max(72).required().messages({
        'number.base': 'Booking deadline hour must be a number',
        'number.integer': 'Booking deadline hour must be an integer',
        'number.min': 'Booking deadline hour must be at least 1',
        'number.max': 'Booking deadline hour cannot exceed 72',
        'any.required': 'Booking deadline hour is required'
    }),
    cancel_buffer_minutes: Joi.number().integer().min(0).max(1440).required().messages({
        'number.base': 'Cancel buffer minutes must be a number',
        'number.integer': 'Cancel buffer minutes must be an integer',
        'number.min': 'Cancel buffer minutes must be at least 0',
        'number.max': 'Cancel buffer minutes cannot exceed 1440',
        'any.required': 'Cancel buffer minutes is required'
    })

});

// Validation schema for private schedule update
const updatePrivateScheduleSchema = Joi.object({
    class_id: Joi.string().uuid().optional().messages({
        'string.uuid': 'Class ID must be a valid UUID'
    }),
    trainer_id: Joi.string().uuid().optional().messages({
        'string.uuid': 'Trainer ID must be a valid UUID'
    }),
    level: Joi.string().valid('Basic', 'Flow').optional().messages({
        'any.only': 'Level must be either Basic or Flow'
    }),
    member_id: Joi.string().uuid().optional().messages({
        'string.uuid': 'Member ID must be a valid UUID'
    }),
    date_start: Joi.date().iso().optional().messages({
        'date.base': 'Date start must be a valid date',
        'date.format': 'Date start must be in ISO format (YYYY-MM-DD)'
    }),
    time_start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().messages({
        'string.pattern.base': 'Time start must be in HH:MM format (24-hour)'
    }),
    time_end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().messages({
        'string.pattern.base': 'Time end must be in HH:MM format (24-hour)'
    }),
    repeat_type: Joi.string().valid('none', 'weekly').optional().messages({
        'any.only': 'Repeat type must be either "none" or "weekly"'
    }),
    schedule_until: Joi.alternatives().try(
        Joi.date().iso(),
        Joi.string().allow('', null),
        Joi.allow(null)
    ).optional().messages({
            'date.base': 'Schedule until must be a valid date',
        'date.format': 'Schedule until must be in ISO format (YYYY-MM-DD)'
    }),
    booking_deadline_hour: Joi.number().integer().min(1).max(72).optional().messages({
        'number.base': 'Booking deadline hour must be a number',
        'number.integer': 'Booking deadline hour must be an integer',
        'number.min': 'Booking deadline hour must be at least 1',
        'number.max': 'Booking deadline hour cannot exceed 72'
    }),

 
    cancel_buffer_minutes: Joi.number().integer().min(0).max(1440).optional().messages({
        'number.base': 'Cancel buffer minutes must be a number',
        'number.integer': 'Cancel buffer minutes must be an integer',
        'number.min': 'Cancel buffer minutes must be at least 0',
        'number.max': 'Cancel buffer minutes cannot exceed 1440'
    })
});

// Validation schema for getting private schedules
const getPrivateScheduleSchema = Joi.object({
    page: Joi.number().integer().min(1).optional().default(1).messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1'
    }),
    limit: Joi.number().integer().min(1).max(100).optional().default(10).messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
    }),
    search: Joi.string().optional().allow('').messages({
        'string.base': 'Search must be a string'
    }),
    date: Joi.date().iso().optional().messages({
        'date.base': 'Date must be a valid date',
        'date.format': 'Date must be in ISO format (YYYY-MM-DD)'
    })
});

const getScheduleCalendarSchema = Joi.object({
    month: Joi.number()
        .integer()
        .min(1)
        .max(12)
        .optional()
        .messages({
            'number.base': 'Bulan harus berupa angka',
            'number.integer': 'Bulan harus berupa angka bulat',
            'number.min': 'Bulan harus antara 1-12',
            'number.max': 'Bulan harus antara 1-12'
        }),
    year: Joi.number()
        .integer()
        .min(2020)
        .max(2100)
        .optional()
        .messages({
            'number.base': 'Tahun harus berupa angka',
            'number.integer': 'Tahun harus berupa angka bulat',
            'number.min': 'Tahun harus antara 2020-2100',
            'number.max': 'Tahun harus antara 2020-2100'
        }),
    type: Joi.string()
        .valid('group', 'semi_private', 'private')
        .optional()
        .messages({
            'any.only': 'Tipe schedule harus berupa group, semi_private, atau private'
        }),
    include_members: Joi.string()
        .valid('true', 'false')
        .optional()
        .default('false')
        .messages({
            'any.only': 'Include members harus berupa true atau false'
        })
});

// Validation schema for getting group schedule by ID
const getGroupScheduleByIdSchema = Joi.object({
    id: Joi.string().uuid().required().messages({
        'string.empty': 'Schedule ID is required',
        'string.uuid': 'Schedule ID must be a valid UUID',
        'any.required': 'Schedule ID is required'
    })
});

// Validation schema for getting semi-private schedule by ID
const getSemiPrivateScheduleByIdSchema = Joi.object({
    id: Joi.string().uuid().required().messages({
        'string.empty': 'Schedule ID is required',
        'string.uuid': 'Schedule ID must be a valid UUID',
        'any.required': 'Schedule ID is required'
    })
});

// Validation schema for getting private schedule by ID
const getPrivateScheduleByIdSchema = Joi.object({
    id: Joi.string().uuid().required().messages({
        'string.empty': 'Schedule ID is required',
        'string.uuid': 'Schedule ID must be a valid UUID',
        'any.required': 'Schedule ID is required'
    })
});

module.exports = {
    createGroupScheduleSchema,
    updateGroupScheduleSchema,
    getGroupScheduleSchema,
    createSemiPrivateScheduleSchema,
    updateSemiPrivateScheduleSchema,
    getSemiPrivateScheduleSchema,
    createPrivateScheduleSchema,
    updatePrivateScheduleSchema,
    getPrivateScheduleSchema,
    getScheduleCalendarSchema,
    getGroupScheduleByIdSchema,
    getSemiPrivateScheduleByIdSchema,
    getPrivateScheduleByIdSchema
}; 