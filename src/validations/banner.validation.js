const Joi = require('joi');

const createBannerSchema = Joi.object({
    title: Joi.string().min(3).max(255).required().messages({
        'string.empty': 'Title is required',
        'string.min': 'Title must be at least 3 characters long',
        'string.max': 'Title cannot exceed 255 characters',
        'any.required': 'Title is required'
    })
});

const updateBannerSchema = Joi.object({
    title: Joi.string().min(3).max(255).optional().messages({
        'string.min': 'Title must be at least 3 characters long',
        'string.max': 'Title cannot exceed 255 characters'
    })
});

const getBannerSchema = Joi.object({
    id: Joi.string().uuid().required().messages({
        'string.empty': 'Banner ID is required',
        'string.uuid': 'Banner ID must be a valid UUID',
        'any.required': 'Banner ID is required'
    })
});

module.exports = {
    createBannerSchema,
    updateBannerSchema,
    getBannerSchema
}; 