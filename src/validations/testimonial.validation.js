const Joi = require('joi');

const createTestimonialSchema = Joi.object({
    name: Joi.string().min(2).max(150).required().messages({
        'string.empty': 'Name is required',
        'string.min': 'Name must be at least 2 characters long',
        'string.max': 'Name cannot exceed 150 characters',
        'any.required': 'Name is required'
    }),
    age: Joi.number().integer().min(1).max(150).required().messages({
        'number.base': 'Age must be a number',
        'number.integer': 'Age must be an integer',
        'number.min': 'Age must be at least 1',
        'number.max': 'Age cannot exceed 150',
        'any.required': 'Age is required'
    }),
    content: Joi.string().min(10).max(1000).required().messages({
        'string.empty': 'Content is required',
        'string.min': 'Content must be at least 10 characters long',
        'string.max': 'Content cannot exceed 1000 characters',
        'any.required': 'Content is required'
    })
});

const updateTestimonialSchema = Joi.object({
    name: Joi.string().min(2).max(150).optional().messages({
        'string.min': 'Name must be at least 2 characters long',
        'string.max': 'Name cannot exceed 150 characters'
    }),
    age: Joi.number().integer().min(1).max(150).optional().messages({
        'number.base': 'Age must be a number',
        'number.integer': 'Age must be an integer',
        'number.min': 'Age must be at least 1',
        'number.max': 'Age cannot exceed 150'
    }),
    content: Joi.string().min(10).max(1000).optional().messages({
        'string.min': 'Content must be at least 10 characters long',
        'string.max': 'Content cannot exceed 1000 characters'
    })
});

const getTestimonialSchema = Joi.object({
    id: Joi.string().uuid().required().messages({
        'string.empty': 'Testimonial ID is required',
        'string.uuid': 'Testimonial ID must be a valid UUID',
        'any.required': 'Testimonial ID is required'
    })
});

module.exports = {
    createTestimonialSchema,
    updateTestimonialSchema,
    getTestimonialSchema
}; 