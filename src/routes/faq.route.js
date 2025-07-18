const express = require('express');
const router = express.Router();
const { 
    getAllFaqs, 
    getFaqById, 
    createFaq, 
    updateFaq, 
    deleteFaq 
} = require('../controllers/faq.controller');
const { validateToken, checkRole } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validation.middleware');
const { 
    createFaqSchema, 
    updateFaqSchema, 
    getFaqSchema 
} = require('../validations/faq.validation');

// Public routes - semua user bisa akses
router.get('/', getAllFaqs);
router.get('/:id', validate(getFaqSchema, 'params'), getFaqById);

// Admin only routes - hanya admin yang bisa create, update, delete
router.post('/', 
    validateToken, 
    checkRole('admin'), 
    validate(createFaqSchema), 
    createFaq
);

router.put('/:id', 
    validateToken, 
    checkRole('admin'), 
    validate(getFaqSchema, 'params'),
    validate(updateFaqSchema), 
    updateFaq
);

router.delete('/:id', 
    validateToken, 
    checkRole('admin'), 
    validate(getFaqSchema, 'params'),
    deleteFaq
);

module.exports = router; 