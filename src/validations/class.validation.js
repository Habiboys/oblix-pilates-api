const Joi = require('joi');

// Validation schema untuk create class
const createClassSchema = Joi.object({
    class_name: Joi.string()
        .min(2)
        .max(100)
        .required()
        .messages({
            'string.min': 'Nama kelas minimal 2 karakter',
            'string.max': 'Nama kelas maksimal 100 karakter',
            'any.required': 'Nama kelas wajib diisi'
        }),
    color_sign: Joi.string()
        .pattern(/^#[0-9A-F]{6}$/i)
        .required()
        .messages({
            'string.pattern.base': 'Color sign harus dalam format hex color (contoh: #FF0000)',
            'any.required': 'Color sign wajib diisi'
        })
});

// Validation schema untuk update class
const updateClassSchema = Joi.object({
    class_name: Joi.string()
        .min(2)
        .max(100)
        .optional()
        .messages({
            'string.min': 'Nama kelas minimal 2 karakter',
            'string.max': 'Nama kelas maksimal 100 karakter'
        }),
    color_sign: Joi.string()
        .pattern(/^#[0-9A-F]{6}$/i)
        .optional()
        .messages({
            'string.pattern.base': 'Color sign harus dalam format hex color (contoh: #FF0000)'
        })
});

// Validation schema untuk get all classes
const getAllClassesSchema = Joi.object({
    search: Joi.string()
        .min(1)
        .max(100)
        .optional()
        .messages({
            'string.min': 'Search minimal 1 karakter',
            'string.max': 'Search maksimal 100 karakter'
        }),
    page: Joi.number()
        .integer()
        .min(1)
        .optional()
        .messages({
            'number.base': 'Page harus berupa angka',
            'number.integer': 'Page harus berupa bilangan bulat',
            'number.min': 'Page minimal 1'
        }),
    limit: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .optional()
        .messages({
            'number.base': 'Limit harus berupa angka',
            'number.integer': 'Limit harus berupa bilangan bulat',
            'number.min': 'Limit minimal 1',
            'number.max': 'Limit maksimal 100'
        })
});

// Validation schema untuk get class by ID
const getClassByIdSchema = Joi.object({
    id: Joi.string()
        .uuid()
        .required()
        .messages({
            'string.guid': 'ID harus berupa UUID yang valid',
            'any.required': 'ID wajib diisi'
        })
});

module.exports = {
    createClassSchema,
    updateClassSchema,
    getAllClassesSchema,
    getClassByIdSchema
}; 