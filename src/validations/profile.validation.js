const Joi = require('joi');

// Schema untuk update profile
const updateProfileSchema = Joi.object({
    email: Joi.string().email().allow('', null).optional().messages({
        'string.email': 'Please provide a valid email address'
    }),
    full_name: Joi.string().min(3).max(150).allow('', null).optional().messages({
        'string.min': 'Full name must be at least 3 characters long',
        'string.max': 'Full name cannot exceed 150 characters'
    }),
    username: Joi.string().min(3).max(50).allow('', null).optional().messages({
        'string.min': 'Username must be at least 3 characters long',
        'string.max': 'Username cannot exceed 50 characters'
    }),
    phone_number: Joi.string()
        .pattern(/^\+62[0-9]{9,12}$/)
        .allow('', null)
        .optional()
        .messages({
            'string.pattern.base': 'Phone number must be in format +62xxxxxxxxx (e.g., +6281234567890)'
        }),
    dob: Joi.date().allow('', null).optional().messages({
        'date.base': 'Date of birth must be a valid date'
    }),
    address: Joi.string().max(500).allow('', null).optional().messages({
        'string.max': 'Address cannot exceed 500 characters'
    })
});

// Schema untuk change password
const changePasswordSchema = Joi.object({
    currentPassword: Joi.string().required().messages({
        'any.required': 'Current password is required'
    }),
    newPassword: Joi.string().min(6).required().messages({
        'string.min': 'New password must be at least 6 characters long',
        'any.required': 'New password is required'
    })
});

module.exports = {
    updateProfileSchema,
    changePasswordSchema
};
