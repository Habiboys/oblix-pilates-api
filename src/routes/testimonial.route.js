const express = require('express');
const router = express.Router();
const { 
    getAllTestimonials, 
    getTestimonialById, 
    createTestimonial, 
    updateTestimonial, 
    deleteTestimonial 
} = require('../controllers/testimonial.controller');
const { validateToken, checkRole } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validation.middleware');
const { 
    createTestimonialSchema, 
    updateTestimonialSchema, 
    getTestimonialSchema 
} = require('../validations/testimonial.validation');

// Public routes - semua user bisa akses
router.get('/', getAllTestimonials);
router.get('/:id', validate(getTestimonialSchema, 'params'), getTestimonialById);

// Admin only routes - hanya admin yang bisa create, update, delete
router.post('/', 
    validateToken, 
    checkRole('admin'), 
    validate(createTestimonialSchema), 
    createTestimonial
);

router.put('/:id', 
    validateToken, 
    checkRole('admin'), 
    validate(getTestimonialSchema, 'params'),
    validate(updateTestimonialSchema), 
    updateTestimonial
);

router.delete('/:id', 
    validateToken, 
    checkRole('admin'), 
    validate(getTestimonialSchema, 'params'),
    deleteTestimonial
);

module.exports = router; 