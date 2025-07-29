const Joi = require('joi');

// Schema untuk register
const registerSchema = Joi.object({
    full_name: Joi.string().min(3).max(150).required().messages({
        'string.min': 'Full name must be at least 3 characters long',
        'string.max': 'Full name cannot exceed 150 characters',
        'any.required': 'Full name is required'
    }),
    username: Joi.string().min(3).max(50).required().messages({
        'string.min': 'Username must be at least 3 characters long',
        'string.max': 'Username cannot exceed 50 characters',
        'any.required': 'Username is required'
    }),
    email: Joi.string().email().required().messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
    }),
    dob: Joi.date().required().messages({
        'date.base': 'Date of birth must be a valid date',
        'any.required': 'Date of birth is required'
    }),
    phone_number: Joi.string()
        .pattern(/^\+62[0-9]{9,12}$/)
        .required()
        .messages({
            'string.pattern.base': 'Phone number must be in format +62xxxxxxxxx (e.g., +6281234567890)',
            'any.required': 'Phone number is required'
        }),
    password: Joi.string().min(6).required().messages({
        'string.min': 'Password must be at least 6 characters long',
        'any.required': 'Password is required'
    })
});

// Schema untuk login
const loginSchema = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
    }),
    password: Joi.string().required().messages({
        'any.required': 'Password is required'
    })
});

// Schema untuk forgot password
const forgotPasswordSchema = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
    })
});

// Schema untuk reset password
const resetPasswordSchema = Joi.object({
    token: Joi.string().required().messages({
        'any.required': 'Reset token is required'
    }),
    newPassword: Joi.string().min(6).required().messages({
        'string.min': 'New password must be at least 6 characters long',
        'any.required': 'New password is required'
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
    registerSchema,
    loginSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    changePasswordSchema
};