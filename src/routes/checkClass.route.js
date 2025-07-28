const express = require('express');
const router = express.Router();
const { getAvailableClasses } = require('../controllers/checkClass.controller');
const { validateToken } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validation.middleware');
const { checkClassQuerySchema } = require('../validations/checkClass.validation');

// Get available classes for a specific date
router.get('/', validateToken, validate(checkClassQuerySchema, 'query'), getAvailableClasses);

module.exports = router; 