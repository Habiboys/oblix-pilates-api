const Joi = require('joi');

const createGallerySchema = Joi.object({
    title: Joi.string().min(3).max(255).required().messages({
        'string.empty': 'Title is required',
        'string.min': 'Title must be at least 3 characters long',
        'string.max': 'Title cannot exceed 255 characters',
        'any.required': 'Title is required'
    })
});

const updateGallerySchema = Joi.object({
    title: Joi.string().min(3).max(255).optional().messages({
        'string.min': 'Title must be at least 3 characters long',
        'string.max': 'Title cannot exceed 255 characters'
    })
});

const getGallerySchema = Joi.object({
    id: Joi.string().uuid().required().messages({
        'string.empty': 'Gallery ID is required',
        'string.uuid': 'Gallery ID must be a valid UUID',
        'any.required': 'Gallery ID is required'
    })
});

module.exports = {
    createGallerySchema,
    updateGallerySchema,
    getGallerySchema
}; 