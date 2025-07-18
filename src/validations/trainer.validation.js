const Joi = require('joi');

const createTrainerSchema = Joi.object({
    title: Joi.string().min(3).max(255).required().messages({
        'string.empty': 'Title is required',
        'string.min': 'Title must be at least 3 characters long',
        'string.max': 'Title cannot exceed 255 characters',
        'any.required': 'Title is required'
    }),
    description: Joi.string().min(10).max(1000).required().messages({
        'string.empty': 'Description is required',
        'string.min': 'Description must be at least 10 characters long',
        'string.max': 'Description cannot exceed 1000 characters',
        'any.required': 'Description is required'
    }),
    instagram: Joi.string().uri().allow('', null).optional().messages({
        'string.uri': 'Instagram must be a valid URL'
    }),
    tiktok: Joi.string().uri().allow('', null).optional().messages({
        'string.uri': 'TikTok must be a valid URL'
    })
});

const updateTrainerSchema = Joi.object({
    title: Joi.string().min(3).max(255).optional().messages({
        'string.min': 'Title must be at least 3 characters long',
        'string.max': 'Title cannot exceed 255 characters'
    }),
    description: Joi.string().min(10).max(1000).optional().messages({
        'string.min': 'Description must be at least 10 characters long',
        'string.max': 'Description cannot exceed 1000 characters'
    }),
    instagram: Joi.string().uri().allow('', null).optional().messages({
        'string.uri': 'Instagram must be a valid URL'
    }),
    tiktok: Joi.string().uri().allow('', null).optional().messages({
        'string.uri': 'TikTok must be a valid URL'
    })
});

const getTrainerSchema = Joi.object({
    id: Joi.string().uuid().required().messages({
        'string.empty': 'Trainer ID is required',
        'string.uuid': 'Trainer ID must be a valid UUID',
        'any.required': 'Trainer ID is required'
    })
});

module.exports = {
    createTrainerSchema,
    updateTrainerSchema,
    getTrainerSchema
}; 