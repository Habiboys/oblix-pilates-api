const Joi = require('joi');

const createBlogSchema = Joi.object({
    title: Joi.string().min(3).max(255).required().messages({
        'string.empty': 'Title is required',
        'string.min': 'Title must be at least 3 characters long',
        'string.max': 'Title cannot exceed 255 characters',
        'any.required': 'Title is required'
    }),
    content: Joi.string().min(10).max(10000).required().messages({
        'string.empty': 'Content is required',
        'string.min': 'Content must be at least 10 characters long',
        'string.max': 'Content cannot exceed 10000 characters',
        'any.required': 'Content is required'
    })
});

const updateBlogSchema = Joi.object({
    title: Joi.string().min(3).max(255).optional().messages({
        'string.min': 'Title must be at least 3 characters long',
        'string.max': 'Title cannot exceed 255 characters'
    }),
    content: Joi.string().min(10).max(10000).optional().messages({
        'string.min': 'Content must be at least 10 characters long',
        'string.max': 'Content cannot exceed 10000 characters'
    })
});

const getBlogSchema = Joi.object({
    id: Joi.string().uuid().required().messages({
        'string.empty': 'Blog ID is required',
        'string.uuid': 'Blog ID must be a valid UUID',
        'any.required': 'Blog ID is required'
    })
});

const getBlogBySlugSchema = Joi.object({
    slug: Joi.string().min(3).max(255).required().messages({
        'string.empty': 'Slug is required',
        'string.min': 'Slug must be at least 3 characters long',
        'string.max': 'Slug cannot exceed 255 characters',
        'any.required': 'Slug is required'
    })
});

module.exports = {
    createBlogSchema,
    updateBlogSchema,
    getBlogSchema,
    getBlogBySlugSchema
}; 