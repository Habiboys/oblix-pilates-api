const Joi = require('joi');

const testWhatsAppSchema = Joi.object({
    phone_number: Joi.string()
        .pattern(/^\+?[1-9]\d{1,14}$/)
        .required()
        .messages({
            'string.pattern.base': 'Phone number harus dalam format internasional (contoh: +6281234567890 atau 6281234567890)',
            'any.required': 'Phone number harus diisi'
        }),
    message: Joi.string()
        .min(1)
        .max(1600)
        .required()
        .messages({
            'string.min': 'Message tidak boleh kosong',
            'string.max': 'Message tidak boleh lebih dari 1600 karakter',
            'any.required': 'Message harus diisi'
        })
});

module.exports = {
    testWhatsAppSchema
}; 