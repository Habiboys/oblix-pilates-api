const Joi = require('joi');

const createFaqSchema = Joi.object({
    title: Joi.string().min(3).max(255).required().messages({
        'string.empty': 'Title is required',
        'string.min': 'Title must be at least 3 characters long',
        'string.max': 'Title cannot exceed 255 characters',
        'any.required': 'Title is required'
    }),
    content: Joi.string().min(10).max(1000).required().messages({
        'string.empty': 'Content is required',
        'string.min': 'Content must be at least 10 characters long',
        'string.max': 'Content cannot exceed 1000 characters',
        'any.required': 'Content is required'
    })
});

const updateFaqSchema = Joi.object({
    title: Joi.string().min(3).max(255).optional().messages({
        'string.min': 'Title must be at least 3 characters long',
        'string.max': 'Title cannot exceed 255 characters'
    }),
    content: Joi.string().min(10).max(1000).optional().messages({
        'string.min': 'Content must be at least 10 characters long',
        'string.max': 'Content cannot exceed 1000 characters'
    })
});

const getFaqSchema = Joi.object({
    id: Joi.string().uuid().required().messages({
        'string.empty': 'FAQ ID is required',
        'string.uuid': 'FAQ ID must be a valid UUID',
        'any.required': 'FAQ ID is required'
    })
});

module.exports = {
    createFaqSchema,
    updateFaqSchema,
    getFaqSchema
}; 